export async function fetchApi(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    if (res.status === 401) window.location.href = '/';
    throw new Error('API Error');
  }
  return res.json();
}
