# Budiu-Builder

Budiu-Builder是一个基于GitHub Actions的自动构建系统，用于将GitHub/Gitee仓库自动构建为Docker镜像并推送到指定的镜像仓库。

## 功能特点

- 支持GitHub和Gitee代码仓库作为源代码
- 使用Buildpacks自动识别项目类型并构建Docker镜像
- 支持推送到DockerHub或自定义镜像仓库
- 构建完成后自动通知后端服务

## 使用方法

1. Fork本仓库
2. 在仓库设置中配置以下Secrets:
   - `DOCKER_USERNAME`: Docker仓库用户名
   - `DOCKER_PASSWORD`: Docker仓库密码
   - `BACKEND_NOTIFY_URL`: 构建完成后通知的后端URL
   - `BACKEND_API_KEY`: 后端API认证密钥（可选）

3. 触发构建:
   - 通过API调用触发GitHub Actions工作流
   - 提供源代码仓库地址和构建参数

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