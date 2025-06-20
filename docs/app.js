document.addEventListener('DOMContentLoaded', function () {
  const buildForm = document.getElementById('buildForm');
  const statusCard = document.getElementById('statusCard');
  const statusOutput = document.getElementById('statusOutput');
  const buildDetails = document.getElementById('buildDetails');
  const buildIdDisplay = document.getElementById('buildId');
  const buildStatusDisplay = document.getElementById('buildStatus');
  const createdAtDisplay = document.getElementById('createdAt');
  const updatedAtDisplay = document.getElementById('updatedAt');
  const imageRow = document.getElementById('imageRow');
  const imageUrlDisplay = document.getElementById('imageUrl');
  const refreshStatusButton = document.getElementById('refreshStatus');
  const apiEndpointInput = document.getElementById('apiEndpoint');

  // 检查localStorage中是否有保存的API端点
  if (localStorage.getItem('apiEndpoint')) {
    apiEndpointInput.value = localStorage.getItem('apiEndpoint');
  }

  let currentBuildId = null;

  // 表单提交处理
  buildForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const repoUrl = document.getElementById('repoUrl').value.trim();
    const branch = document.getElementById('branch').value.trim();
    const imageName = document.getElementById('imageName').value.trim();
    const imageTag = document.getElementById('imageTag').value.trim();
    const registry = document.getElementById('registry').value.trim();
    const apiEndpoint = apiEndpointInput.value.trim();

    // 保存API端点
    if (apiEndpoint) {
      localStorage.setItem('apiEndpoint', apiEndpoint);
    }

    // 验证必填字段
    if (!repoUrl) {
      alert('请输入代码仓库URL');
      return;
    }
    if (!imageName) {
      alert('请输入镜像名称');
      return;
    }
    if (!apiEndpoint) {
      alert('请输入API端点');
      return;
    }

    // 显示加载状态
    statusCard.classList.remove('hidden');
    statusOutput.className = 'status pending';
    statusOutput.textContent = '正在提交构建请求...';
    buildDetails.classList.add('hidden');

    // 准备请求数据
    const requestData = {
      repo_url: repoUrl,
      branch: branch || 'main',
      image_name: imageName,
      image_tag: imageTag || 'latest',
      registry: registry || 'docker.io'
    };

    // 发送构建请求
    fetch(`${apiEndpoint}/build`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`请求失败，状态码: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.error) {
          // 显示错误
          statusOutput.className = 'status error';
          statusOutput.textContent = `错误: ${data.error}`;
        } else {
          // 显示成功
          statusOutput.className = 'status success';
          statusOutput.textContent = `构建请求已提交! 构建ID: ${data.build_id}`;

          // 保存构建ID并获取状态
          currentBuildId = data.build_id;
          fetchBuildStatus(currentBuildId, apiEndpoint);
        }
      })
      .catch(error => {
        statusOutput.className = 'status error';
        statusOutput.textContent = `请求失败: ${error.message}`;
      });
  });

  // 刷新状态按钮
  refreshStatusButton.addEventListener('click', function () {
    if (currentBuildId) {
      fetchBuildStatus(currentBuildId, apiEndpointInput.value.trim());
    }
  });

  // 获取构建状态
  function fetchBuildStatus(buildId, apiEndpoint) {
    statusOutput.className = 'status pending';
    statusOutput.textContent = '正在获取构建状态...';

    fetch(`${apiEndpoint}/build/${buildId}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`请求失败，状态码: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // 显示构建详情
        buildDetails.classList.remove('hidden');
        buildIdDisplay.textContent = data.build_id;
        buildStatusDisplay.textContent = getStatusText(data.status);

        if (data.created_at) {
          createdAtDisplay.textContent = formatDate(data.created_at);
        }

        if (data.updated_at) {
          updatedAtDisplay.textContent = formatDate(data.updated_at);
        }

        // 根据状态更新界面
        if (data.status === 'success') {
          statusOutput.className = 'status success';
          statusOutput.textContent = '构建成功!';

          if (data.image) {
            imageRow.classList.remove('hidden');
            imageUrlDisplay.textContent = data.image;
          }
        } else if (data.status === 'failed') {
          statusOutput.className = 'status error';
          statusOutput.textContent = '构建失败!';
        } else {
          statusOutput.className = 'status pending';
          statusOutput.textContent = '构建进行中...';

          // 每10秒自动刷新一次
          setTimeout(() => fetchBuildStatus(buildId, apiEndpoint), 10000);
        }
      })
      .catch(error => {
        statusOutput.className = 'status error';
        statusOutput.textContent = `获取状态失败: ${error.message}`;
      });
  }

  // 辅助函数
  function getStatusText(status) {
    switch (status) {
      case 'pending': return '进行中';
      case 'success': return '成功';
      case 'failed': return '失败';
      default: return status;
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString('zh-CN');
    } catch (e) {
      return dateStr;
    }
  }
}); 