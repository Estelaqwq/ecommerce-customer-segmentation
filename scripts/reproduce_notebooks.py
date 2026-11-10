"""按顺序执行并保存 Notebook；从任何工作目录调用均可。"""
from pathlib import Path
import sys

import nbformat
from nbclient import NotebookClient

ROOT = Path(__file__).resolve().parents[1]

for path in sorted((ROOT / 'notebooks').glob('*.ipynb')):
    print(f'执行 {path.name}', flush=True)
    notebook = nbformat.read(path, as_version=4)
    client = NotebookClient(
        notebook, timeout=180, kernel_name='python3',
        resources={'metadata': {'path': str(ROOT / 'notebooks')}},
    )
    client.execute()
    # 保存结果用于 GitHub 阅读；运行出错时不覆盖原 Notebook。
    nbformat.write(notebook, path)
    print(f'完成 {path.name}', flush=True)

print('全部 Notebook 已执行并保存。')
