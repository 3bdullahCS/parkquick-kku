import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || "parkquick-reports";
const RATE_LIMIT_MS = 2 * 60 * 1000;
const TTL_SECONDS = 15 * 60;
const VALID_ZONES = new Set(["F-A","F-B","F-C","F-D","B-A","B-B","B-C","B-D"]);
export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}"); const { zoneId, score, visitorId } = body;
    if (!zoneId || !VALID_ZONES.has(zoneId)) return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Invalid zoneId" }) };
    if (typeof score !== "number" || score < 0 || score > 100) return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Score must be 0-100" }) };
    if (!visitorId || typeof visitorId !== "string") return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "visitorId required" }) };
    const now = Date.now(); const rateCutoff = now - RATE_LIMIT_MS;
    const { Items: recentReports = [] } = await ddb.send(new QueryCommand({ TableName: TABLE_NAME, IndexName: "visitorId-index", KeyConditionExpression: "visitorId = :v AND #ts > :cutoff", ExpressionAttributeNames: { "#ts": "timestamp" }, ExpressionAttributeValues: { ":v": visitorId, ":cutoff": rateCutoff }, Limit: 1 }));
    if (recentReports.length > 0) { const waitSeconds = Math.ceil((RATE_LIMIT_MS - (now - recentReports[0].timestamp)) / 1000); return { statusCode: 429, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Rate limited", waitSeconds, message: `انتظر ${waitSeconds} ثانية` }) }; }
    const ttl = Math.floor(now / 1000) + TTL_SECONDS;
    await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: { zoneId, timestamp: now, score, visitorId, ttl } }));
    return { statusCode: 201, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ success: true, message: "تم إرسال تقريرك بنجاح", report: { zoneId, score, timestamp: now } }) };
  } catch (error) { console.error("Error:", error); return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Internal server error" }) }; }
};
