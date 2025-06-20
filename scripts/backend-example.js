const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// 环境变量配置
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || 'niehaoran/Budiu-Builder';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || 'your-api-key';

// 中间件
app.use(bodyParser.json());

// 验证API密钥
const verifyApiKey = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== BACKEND_API_KEY) {
    return res.status(401).json({ error: '无效的API密钥' });
  }
  next();
};

// 接收用户提交的GitHub/Gitee链接
app.post('/api/build', async (req, res) => {
  try {
    const { repo_url, branch = 'main', image_name, image_tag = 'latest', registry = 'docker.io' } = req.body;

    // 验证必填参数
    if (!repo_url || !image_name) {
      return res.status(400).json({ error: '缺少必填参数: repo_url, image_name' });
    }

    // 回调URL是本服务的通知端点
    const callback_url = `${req.protocol}://${req.get('host')}/api/build-callback`;

    // 调用GitHub Actions API触发构建
    const response = await axios({
      method: 'POST',
      url: `https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/workflows/build.yml/dispatches`,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        ref: 'main',
        inputs: {
          repo_url,
          branch,
          image_name,
          image_tag,
          registry,
          callback_url
        }
      }
    });

    // GitHub Actions API成功触发不返回内容，状态码为204
    res.status(202).json({
      message: '构建任务已提交',
      build_id: `${Date.now()}`, // 简单的构建ID生成
      status: 'pending'
    });

  } catch (error) {
    console.error('触发构建失败:', error.message);
    res.status(500).json({ error: '触发构建失败', details: error.message });
  }
});

// 接收来自GitHub Actions的构建完成通知
app.post('/api/build-callback', verifyApiKey, (req, res) => {
  try {
    const { status, image, repo_url, build_id } = req.body;

    console.log(`收到构建完成通知: ${status}`);
    console.log(`仓库: ${repo_url}`);
    console.log(`构建ID: ${build_id}`);

    if (status === 'success' && image) {
      console.log(`镜像地址: ${image}`);

      // 这里可以添加创建工作负载和服务的代码
      // 例如调用Kubernetes API创建Deployment和Service

      // 模拟处理
      console.log('开始创建工作负载和服务...');
      setTimeout(() => {
        console.log('工作负载和服务已创建完成');
      }, 2000);
    } else {
      console.log('构建失败，不创建工作负载');
    }

    res.status(200).json({ message: '通知已接收' });

  } catch (error) {
    console.error('处理构建通知失败:', error.message);
    res.status(500).json({ error: '处理构建通知失败', details: error.message });
  }
});

// 查询构建状态的API (模拟实现)
app.get('/api/build/:buildId', (req, res) => {
  const buildId = req.params.buildId;

  // 这里应该是从数据库查询构建状态
  // 这里只是模拟返回
  res.json({
    build_id: buildId,
    status: Math.random() > 0.3 ? 'success' : 'pending',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date().toISOString(),
    image: Math.random() > 0.3 ? 'docker.io/example/app:latest' : null
  });
});

// 启动服务器
app.listen(port, () => {
  console.log(`后端服务运行在 http://localhost:${port}`);
  console.log(`通知回调URL: http://localhost:${port}/api/build-callback`);
}); 