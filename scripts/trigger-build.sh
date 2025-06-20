#!/bin/bash

# 默认值
GITHUB_TOKEN=""
REPOSITORY="your-username/Budiu-Builder"
REPO_URL=""
BRANCH="main"
IMAGE_NAME=""
IMAGE_TAG="latest"
REGISTRY="docker.io"
CALLBACK_URL=""

# 显示帮助
show_help() {
  echo "用法: $0 [选项]"
  echo
  echo "选项:"
  echo "  -t, --token TOKEN        GitHub个人访问令牌 (必须)"
  echo "  -r, --repository REPO    GitHub仓库，格式: 用户名/仓库名 (默认: ${REPOSITORY})"
  echo "  -s, --source URL         源代码仓库URL (必须)"
  echo "  -b, --branch BRANCH      分支名称 (默认: ${BRANCH})"
  echo "  -i, --image NAME         镜像名称 (必须)"
  echo "  -v, --tag TAG            镜像标签 (默认: ${IMAGE_TAG})"
  echo "  -d, --registry URL       镜像仓库地址 (默认: ${REGISTRY})"
  echo "  -c, --callback URL       回调通知URL (可选)"
  echo "  -h, --help               显示此帮助信息"
  echo
  echo "示例:"
  echo "  $0 -t ghp_xxxx -s https://github.com/user/repo -i myapp -c https://api.example.com/callback"
}

# 解析参数
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -t|--token)
      GITHUB_TOKEN="$2"
      shift
      shift
      ;;
    -r|--repository)
      REPOSITORY="$2"
      shift
      shift
      ;;
    -s|--source)
      REPO_URL="$2"
      shift
      shift
      ;;
    -b|--branch)
      BRANCH="$2"
      shift
      shift
      ;;
    -i|--image)
      IMAGE_NAME="$2"
      shift
      shift
      ;;
    -v|--tag)
      IMAGE_TAG="$2"
      shift
      shift
      ;;
    -d|--registry)
      REGISTRY="$2"
      shift
      shift
      ;;
    -c|--callback)
      CALLBACK_URL="$2"
      shift
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo "未知选项: $1"
      show_help
      exit 1
      ;;
  esac
done

# 检查必须参数
if [ -z "$GITHUB_TOKEN" ] || [ -z "$REPO_URL" ] || [ -z "$IMAGE_NAME" ]; then
  echo "错误: 缺少必须参数"
  show_help
  exit 1
fi

# 构建JSON请求主体
JSON_DATA=$(cat <<EOF
{
  "ref": "main",
  "inputs": {
    "repo_url": "$REPO_URL",
    "branch": "$BRANCH",
    "image_name": "$IMAGE_NAME",
    "image_tag": "$IMAGE_TAG",
    "registry": "$REGISTRY",
    "callback_url": "$CALLBACK_URL"
  }
}
EOF
)

echo "正在触发构建..."
echo "源代码仓库: $REPO_URL"
echo "目标镜像: $REGISTRY/$IMAGE_NAME:$IMAGE_TAG"

# 发送请求到GitHub API
RESPONSE=$(curl -s -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token $GITHUB_TOKEN" \
  -d "$JSON_DATA" \
  "https://api.github.com/repos/$REPOSITORY/actions/workflows/build.yml/dispatches")

# 检查响应
if [ -z "$RESPONSE" ]; then
  echo "成功: 构建工作流已触发"
  echo "请在GitHub Actions页面查看构建进度: https://github.com/$REPOSITORY/actions"
else
  echo "错误: 无法触发工作流"
  echo "$RESPONSE"
  exit 1
fi 