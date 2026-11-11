import JSZip from 'jszip';
import { REPO_FILES } from '../data/repoFiles';

export async function exportRepositoryZip(): Promise<void> {
  const zip = new JSZip();

  // Root folder
  const rootFolder = zip.folder('sistema-distribuido-sockets');
  if (!rootFolder) return;

  for (const file of REPO_FILES) {
    rootFolder.file(file.path, file.content);
  }

  // Add a sample run script for convenience
  rootFolder.file(
    'run_local.sh',
    `#!/bin/bash
# Script de inicio rápido local sin Docker
echo "Creando entorno virtual..."
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

echo "Para iniciar los servicios en terminales separadas:"
echo "Terminal 1: python server.py --port 9001"
echo "Terminal 2: python worker.py --worker-id worker-1 --threads 4"
echo "Terminal 3: python client.py submit --task-type matrix_mult"
`
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sistema-distribuido-sockets.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
