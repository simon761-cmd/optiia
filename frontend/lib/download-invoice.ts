import { getAccessToken } from './auth-store';
import { API_URL } from './api';

export async function downloadInvoice(saleId: string, mode: 'view' | 'download' = 'view') {
  const token = getAccessToken();
  if (!token) throw new Error('Non authentifié');

  const res = await fetch(`${API_URL}/api/v1/sales/${saleId}/invoice`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Erreur ${res.status} lors du téléchargement`);

  const disposition = res.headers.get('Content-Disposition') ?? '';
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch?.[1] ?? `facture-${saleId}.pdf`;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  if (mode === 'view') {
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
