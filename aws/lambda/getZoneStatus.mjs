import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || "parkquick-reports";
const TTL_MS = 15 * 60 * 1000;
const ALL_ZONES = ["F-A","F-B","F-C","F-D","B-A","B-B","B-C","B-D"];
const FRONT_ZONES = ["F-A","F-B","F-C","F-D"];
const BACK_ZONES = ["B-A","B-B","B-C","B-D"];
function scoreToCongestion(s) { if (s >= 67) return "red"; if (s >= 34) return "orange"; return "green"; }
function calculateStatus(reports) {
  const now = Date.now(); const active = reports.filter(r => now - r.timestamp < TTL_MS);
  if (active.length === 0) return { congestion: "unknown", avgScore: 0, reportCount: 0, lastUpdate: null };
  const FRESH = 5 * 60 * 1000; let tw = 0, ws = 0;
  for (const r of active) { const w = (now - r.timestamp) < FRESH ? 1.0 : 0.5; ws += r.score * w; tw += w; }
  const avgScore = Math.round(ws / tw);
  return { congestion: scoreToCongestion(avgScore), avgScore, reportCount: active.length, lastUpdate: Math.max(...active.map(r => r.timestamp)) };
}
export const handler = async (event) => {
  try {
    const side = event.queryStringParameters?.side;
    const zones = side === "front" ? FRONT_ZONES : side === "back" ? BACK_ZONES : ALL_ZONES;
    const cutoff = Date.now() - TTL_MS;
    const results = await Promise.all(zones.map(async (zoneId) => {
      const { Items = [] } = await ddb.send(new QueryCommand({ TableName: TABLE_NAME, KeyConditionExpression: "zoneId = :z AND #ts > :cutoff", ExpressionAttributeNames: { "#ts": "timestamp" }, ExpressionAttributeValues: { ":z": zoneId, ":cutoff": cutoff } }));
      return { zoneId, ...calculateStatus(Items) };
    }));
    const statusMap = {}; for (const r of results) statusMap[r.zoneId] = { congestion: r.congestion, avgScore: r.avgScore, reportCount: r.reportCount, lastUpdate: r.lastUpdate };
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ zones: statusMap }) };
  } catch (error) { console.error("Error:", error); return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Internal server error" }) }; }
};
