import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || "parkquick-reports";
const TTL_MS = 15 * 60 * 1000;
const FRONT_ZONES = ["F-A","F-B","F-C","F-D"];
const BACK_ZONES = ["B-A","B-B","B-C","B-D"];
function calculateAvgScore(reports) {
  const now = Date.now(); const active = reports.filter(r => now - r.timestamp < TTL_MS);
  if (active.length === 0) return -1;
  const FRESH = 5 * 60 * 1000; let tw = 0, ws = 0;
  for (const r of active) { const w = (now - r.timestamp) < FRESH ? 1.0 : 0.5; ws += r.score * w; tw += w; }
  return Math.round(ws / tw);
}
export const handler = async (event) => {
  try {
    const side = event.queryStringParameters?.side;
    if (!side || (side !== "front" && side !== "back")) return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "side parameter required (front or back)" }) };
    const zones = side === "front" ? FRONT_ZONES : BACK_ZONES;
    const cutoff = Date.now() - TTL_MS;
    const results = await Promise.all(zones.map(async (zoneId) => {
      const { Items = [] } = await ddb.send(new QueryCommand({ TableName: TABLE_NAME, KeyConditionExpression: "zoneId = :z AND #ts > :cutoff", ExpressionAttributeNames: { "#ts": "timestamp" }, ExpressionAttributeValues: { ":z": zoneId, ":cutoff": cutoff } }));
      return { zoneId, avgScore: calculateAvgScore(Items) };
    }));
    let best = results[0]; for (const r of results) if (r.avgScore < best.avgScore) best = r;
    const congestion = best.avgScore >= 67 ? "red" : best.avgScore >= 34 ? "orange" : best.avgScore >= 0 ? "green" : "unknown";
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ bestZone: best.zoneId, avgScore: best.avgScore, congestion, side }) };
  } catch (error) { console.error("Error:", error); return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Internal server error" }) }; }
};
