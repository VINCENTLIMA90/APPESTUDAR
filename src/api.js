export async function api(path, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch('/api' + path, { method, credentials: 'same-origin', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || 'error'); error.status = response.status;error.data=data;if(data.error==='session_replaced')window.dispatchEvent(new Event('rumbo-session-replaced')); throw error; }
  return data;
}
