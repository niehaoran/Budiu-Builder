# Budiu-Builder

Budiu-Builder是一个基于GitHub Actions的自动构建系统，用于将GitHub/Gitee仓库自动构建为Docker镜像并推送到指定的镜像仓库。

## 功能特点

- 支持GitHub和Gitee代码仓库作为源代码
- 支持公开和私有仓库（通过访问令牌）
- 使用Buildpacks自动识别项目类型并构建Docker镜像
- 支持推送到DockerHub或任意自定义镜像仓库
- 构建完成后可选择性通知后端服务
- 提供用户友好的Web界面，可部署在GitHub Pages上
- 支持直接调用GitHub Actions（无需后端服务）

## 使用方法

### 服务器端设置

1. Fork本仓库
2. 在仓库设置中配置以下Secrets（如果需要通过后端服务触发）:
   - `DOCKER_USERNAME`: Docker仓库默认用户名
   - `DOCKER_PASSWORD`: Docker仓库默认密码或令牌
   - `BACKEND_API_KEY`: 后端API认证密钥（可选）

3. 触发构建:
   - 通过API调用触发GitHub Actions工作流
   - 通过Web界面提交构建请求

### Web界面部署

本项目包含一个用户友好的Web界面，可以轻松部署到GitHub Pages：

1. 在仓库的"Settings"选项卡中，找到"Pages"部分
2. 在"Source"下拉菜单中选择"main branch"和"/docs"文件夹
3. 点击"Save"按钮
4. GitHub会生成一个URL（通常是 `https://{username}.github.io/Budiu-Builder`）
5. 部署完成后，您可以通过该URL访问Web界面

### 安全性说明

本系统处理敏感信息的方式：

1. **Docker凭据** - 用户输入的凭据直接传递给GitHub Actions，不会在前端存储
2. **仓库令牌** - 用于访问私有仓库的令牌仅在构建过程中使用，不会被保存
3. **GitHub令牌** - 用于触发工作流的令牌仅在API请求中使用，不会被前端存储
4. **本地存储** - 默认仅保存非敏感信息（仓库URL、镜像名称等）

## 使用方式

### 直接使用Web界面（无需后端）

1. 访问Web界面（GitHub Pages部署）
2. 填写代码仓库信息
3. 提供Docker凭据（用于推送镜像）
4. 提供GitHub令牌（用于触发工作流）
5. 留空API端点和回调URL
6. 点击提交构建请求

### 通过后端服务使用

1. 访问Web界面
2. 填写代码仓库信息和Docker凭据
3. 提供后端API端点
4. 可选择性提供回调URL
5. 点击提交构建请求

## 后端API集成

要将Web界面与您的后端服务集成，需要确保后端服务实现以下API端点：

1. `POST /api/build` - 接收构建请求
   - 请求体: 
   ```json
   { 
     "repo_url": "仓库地址",
     "branch": "分支名称",
     "image_name": "镜像名称",
     "image_tag": "镜像标签",
     "registry": "镜像仓库地址",
     "docker_username": "Docker用户名",
     "docker_password": "Docker密码/令牌",
     "repo_token": "仓库访问令牌(可选)",
     "callback_url": "回调通知URL(可选)"
   }
   ```
   - 响应: `{ build_id, status, message }`

2. `GET /api/build/:buildId` - 获取构建状态
   - 响应: `{ build_id, status, created_at, updated_at, image }`

参考 `scripts/backend-example.js` 文件查看示例实现。

## 工作流程

1. 用户提交GitHub/Gitee仓库链接到前端界面
2. 根据选择的方式：
   - 直接调用GitHub Actions API
   - 通过后端服务触发GitHub Actions
3. GitHub Actions克隆代码，使用Buildpacks构建镜像
4. GitHub Actions推送镜像到指定的Docker仓库
5. 如果提供了回调URL，GitHub Actions通知指定服务构建完成
6. 用户可以部署和访问构建好的应用

## 所需GitHub令牌权限

如果您选择直接调用GitHub Actions（不经过后端），需要创建具有以下权限的GitHub个人访问令牌：

- `repo` - 完整的仓库访问权限（用于触发工作流）
- `workflow` - 更新GitHub Actions工作流文件的权限

创建令牌的步骤：
1. 访问GitHub设置页面
2. 点击"Developer settings"
3. 选择"Personal access tokens" > "Tokens (classic)"
4. 点击"Generate new token"
5. 选择上述权限并创建令牌

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