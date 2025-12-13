#!/bin/bash

# Brave Search API 测试脚本
# 使用方法: ./test-brave-api.sh YOUR_API_KEY

if [ -z "$1" ]; then
  echo "错误: 请提供 API Key"
  echo "使用方法: ./test-brave-api.sh YOUR_API_KEY"
  exit 1
fi

API_KEY="$1"
QUERY="AI培训师东波哥"

echo "正在测试 Brave Search API..."
echo "查询: $QUERY"
echo ""

# 测试基本搜索
curl -s --compressed \
  "https://api.search.brave.com/res/v1/web/search?q=$(echo "$QUERY" | sed 's/ /+/g')&count=10" \
  -H "Accept: application/json" \
  -H "Accept-Encoding: gzip" \
  -H "X-Subscription-Token: $API_KEY" \
  | python3 -m json.tool 2>/dev/null || cat

echo ""
echo ""
echo "如果看到搜索结果，说明 API Key 配置正确"
echo "如果看到错误信息，请检查："
echo "1. API Key 是否正确"
echo "2. API Key 是否有足够的权限"
echo "3. 网络连接是否正常"
