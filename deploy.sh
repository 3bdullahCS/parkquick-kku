#!/bin/bash
set -e
REGION="${1:-us-east-1}"
ENV="${2:-prod}"
STACK_NAME="parkquick-${ENV}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ParkQuick KKU — Deploying to AWS"
echo "  Region: ${REGION} | Env: ${ENV}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "📦 Step 1: Deploying CloudFormation stack..."
aws cloudformation deploy \
  --template-file aws/infra/template.yaml \
  --stack-name "${STACK_NAME}" \
  --parameter-overrides Environment="${ENV}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "${REGION}" \
  --no-fail-on-empty-changeset

echo ""
echo "📋 Step 2: Getting stack outputs..."
API_URL=$(aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --region "${REGION}" --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
echo "  API URL: ${API_URL}"

echo ""
echo "⚡ Step 3: Deploying Lambda functions..."
for fn in getZoneStatus submitReport getBestZone; do
  echo "  Deploying ${fn}..."
  cd aws/lambda
  cp "${fn}.mjs" index.mjs
  zip -j "/tmp/${fn}.zip" index.mjs
  rm index.mjs
  aws lambda update-function-code \
    --function-name "parkquick-${fn}-${ENV}" \
    --zip-file "fileb:///tmp/${fn}.zip" \
    --region "${REGION}" \
    --no-cli-pager > /dev/null
  cd ../..
done
echo "  ✅ All Lambda functions deployed"

echo ""
echo "🔧 Step 4: Creating .env.production..."
echo "VITE_API_URL=${API_URL}" > .env.production
echo "VITE_API_URL=${API_URL}" > .env.local

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Backend deployed!"
echo ""
echo "  🔌 API: ${API_URL}"
echo ""
echo "  Test: curl ${API_URL}/zones/status"
echo ""
echo "  Next: npm run dev (to test locally)"
echo "  Then: git add . && git commit -m 'connect api' && git push"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
