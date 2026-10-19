export const PROVIDERS = {
  siliconflow: { name: 'SiliconFlow', base: 'https://api.siliconflow.cn/v1', asr: 'XingChenAGI/XingChenASR-V3.2-Ultra', chat: 'XingChenAGI/Xing4.0-29B' },
  openai: { name: 'OpenAI', base: 'https://api.openai.com/v1', asr: 'gpt-transcribe', chat: 'gpt-4.1-mini' }
};
export async function apiRequest(provider, endpoint, key, body, json = false, fetcher = fetch) {
  const config = PROVIDERS[provider];
  if (!config) throw new Error('请选择有效的 API 服务商。');
  if (!key || /[\r\n]/.test(key)) throw new Error('请先填写该服务商的 API Key。');
  let res;
  try {
    res = await fetcher(config.base + endpoint, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, ...(json ? {'Content-Type':'application/json'} : {}) },
      body: json ? JSON.stringify(body) : body, signal: AbortSignal.timeout(600000)
    });
  } catch (e) {
    const code=e.cause?.code||e.code;
    const reasons={
      EACCES:'本地服务的网络访问被运行环境拒绝（EACCES）。请在正常网络权限下重启本地服务；更换 API Key 或改存 TXT 无法解决。',
      EPERM:'本地服务没有访问外网的权限（EPERM），请在正常网络权限下重启。',
      ENOTFOUND:'无法解析 API 域名（ENOTFOUND），请检查 DNS。',
      EAI_AGAIN:'API 域名解析暂时失败（EAI_AGAIN），请稍后重试。',
      ECONNREFUSED:'API 连接被拒绝（ECONNREFUSED），请检查代理或网络。',
      ECONNRESET:'API 连接被中断（ECONNRESET），请检查网络或代理。',
      UND_ERR_CONNECT_TIMEOUT:'连接 API 超时（UND_ERR_CONNECT_TIMEOUT），请检查网络或代理。',
      CERT_HAS_EXPIRED:'API TLS 证书过期，请检查系统时间或网络代理。',
      UNABLE_TO_VERIFY_LEAF_SIGNATURE:'无法验证 API TLS 证书，请检查系统证书或网络代理。'
    };
    throw new Error(e.name === 'TimeoutError' ? 'API 请求超时，请稍后重新尝试。' : reasons[code]||'无法连接 API，请检查网络连接及服务商可用区域。');
  }
  const raw = await res.text();
  if (!res.ok) {
    const hints = {401:'API Key 无效或已过期',403:'账户权限、地区或余额受限',404:'模型或接口不可用，请检查模型名称',413:'音频超过服务商限制',429:'达到速率限制或账户额度不足',500:'服务商内部错误',503:'模型服务繁忙',504:'服务商处理超时'};
    // Do not forward raw provider messages, which can contain request details.
    throw new Error(`${config.name} 返回 ${res.status}：${hints[res.status] || '请求失败，请检查模型、文件与账户状态'}。`);
  }
  try { return JSON.parse(raw); } catch { throw new Error('服务商未返回有效 JSON。'); }
}
