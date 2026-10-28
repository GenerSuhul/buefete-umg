"""Render the user guide for visual verification; generated images are not source assets."""
from pathlib import Path
import pypdfium2
from PIL import Image, ImageDraw

folder = Path(__file__).resolve().parents[1] / 'output/pdf'
document = pypdfium2.PdfDocument(folder / 'manual-bufete-umg.pdf')
sheet = Image.new('RGB', (1200, ((len(document)+3)//4)*450), '#dfe5e9')
for index, page in enumerate(document):
    path = folder / f'page-{index+1}.png'
    page.render(scale=1.5).to_pil().save(path)
    thumb = Image.open(path).convert('RGB')
    thumb.thumbnail((285, 415))
    x, y = (index%4)*300, (index//4)*450
    sheet.paste(thumb, (x,y))
    ImageDraw.Draw(sheet).text((x+8,y+423), str(index+1), fill='#103958')
sheet.save(folder / 'contact-sheet.png')
print(f'Rendered {len(document)} pages')
