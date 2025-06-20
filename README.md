# Budiu-Builder

Budiu-Builder是一个基于GitHub Actions的自动构建系统，用于将GitHub/Gitee仓库自动构建为Docker镜像并推送到指定的镜像仓库。

## 功能特点

- 支持GitHub和Gitee代码仓库作为源代码
- 使用Buildpacks自动识别项目类型并构建Docker镜像
- 支持推送到DockerHub或自定义镜像仓库
- 构建完成后自动通知后端服务
- 提供用户友好的Web界面，可部署在GitHub Pages上

## 使用方法

### 服务器端设置

1. Fork本仓库
2. 在仓库设置中配置以下Secrets:
   - `DOCKER_USERNAME`: Docker仓库用户名
   - `DOCKER_PASSWORD`: Docker仓库密码
   - `BACKEND_NOTIFY_URL`: 构建完成后通知的后端URL
   - `BACKEND_API_KEY`: 后端API认证密钥（可选）

3. 触发构建:
   - 通过API调用触发GitHub Actions工作流
   - 提供源代码仓库地址和构建参数

### Web界面部署

本项目包含一个用户友好的Web界面，可以轻松部署到GitHub Pages：

1. 在仓库的"Settings"选项卡中，找到"Pages"部分
2. 在"Source"下拉菜单中选择"main branch"和"/docs"文件夹
3. 点击"Save"按钮
4. GitHub会生成一个URL（通常是 `https://{username}.github.io/Budiu-Builder`）
5. 部署完成后，您可以通过该URL访问Web界面

## 后端API集成

要将Web界面与您的后端服务集成，需要确保后端服务实现以下API端点：

1. `POST /api/build` - 接收构建请求
   - 请求体: `{ repo_url, branch, image_name, image_tag, registry }`
   - 响应: `{ build_id, status, message }`

2. `GET /api/build/:buildId` - 获取构建状态
   - 响应: `{ build_id, status, created_at, updated_at, image }`

参考 `scripts/backend-example.js` 文件查看示例实现。

## 工作流程

1. 用户提交GitHub/Gitee仓库链接到国内官网
2. 国内后端发送请求到GitHub Actions
3. GitHub Actions克隆代码，使用Buildpacks构建镜像
4. GitHub Actions推送镜像到指定的Docker仓库
5. GitHub Actions通知国内后端构建完成
6. 国内后端创建工作负载和服务
7. 用户可以访问部署好的应用

## 配置文件

查看 `.github/workflows/build.yml` 获取工作流配置详情。

## API接口文档

### 触发构建

```
POST /api/build

请求体:
{
  "repo_url": "https://github.com/username/repo",
  "branch": "main",  // 可选，默认为main
  "image_name": "username/app",
  "image_tag": "latest",  // 可选，默认为latest
  "registry": "docker.io"  // 可选，默认为docker.io
}

响应:
{
  "build_id": "12345",
  "status": "pending",
  "message": "构建任务已提交"
}
```

### 查询构建状态

```
GET /api/build/:buildId

响应:
{
  "build_id": "12345",
  "status": "success",  // pending, success, failed
  "created_at": "2023-04-01T12:00:00Z",
  "updated_at": "2023-04-01T12:05:30Z",
  "image": "docker.io/username/app:latest"  // 只在构建成功时返回
}
```