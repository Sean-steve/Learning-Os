import { test, expect } from '@playwright/test';

function samplePdf(): Buffer {
  const stream = (text: string) => { const data=`BT /F1 18 Tf 35 440 Td (${text}) Tj ET\n`; return `<< /Length ${Buffer.byteLength(data)} >>\nstream\n${data}endstream`; };
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 500] /Resources << /Font << /F1 4 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 500] /Resources << /Font << /F1 4 0 R >> >> /Contents 7 0 R >>',
    stream('Dream recall lesson one'),
    stream('Second learning page'),
  ];
  let content='%PDF-1.4\n'; const offsets=[0];
  objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(content));content+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
  const start=Buffer.byteLength(content);
  content+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++)content+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  content+=`trailer\n<< /Root 1 0 R /Size ${objects.length+1} >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(content);
}

function sampleWav(): Buffer {
  const pcmBytes=88200;const data=Buffer.alloc(44+pcmBytes);
  data.write('RIFF',0);data.writeUInt32LE(36+pcmBytes,4);data.write('WAVEfmt ',8);
  data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);
  data.writeUInt32LE(44100,24);data.writeUInt32LE(88200,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);
  data.write('data',36);data.writeUInt32LE(pcmBytes,40);return data;
}

test('Phase 3 Media Studio is navigable and responsive',async ({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/#studio');
  await expect(page.getByRole('heading',{name:'Learning media studio'})).toBeVisible();
  await expect(page.getByRole('tab',{name:'YouTube'})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('iframe[title="YouTube learning video"]')).toHaveCount(1);
  await expect(page.getByText('Browser-local sync:')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+4)).toBe(false);
  expect(errors).toEqual([]);
});
test('YouTube paste, manually complete, bookmark and reload',async ({page})=>{
  await page.goto('/#studio');
  await page.getByRole('textbox',{name:'YouTube video or playlist URL'}).fill('https://youtu.be/dQw4w9WgXcQ');
  await page.getByRole('button',{name:'Load link'}).click();
  await expect(page.locator('iframe[title="YouTube learning video"]')).toHaveAttribute('src',/dQw4w9WgXcQ/);
  await page.getByRole('spinbutton',{name:'YouTube bookmark minute'}).fill('3');
  await page.getByRole('textbox',{name:'Bookmark title'}).fill('Key point');
  await page.getByRole('button',{name:'Save bookmark'}).click();
  await expect(page.getByText('Key point')).toBeVisible();
  await page.getByRole('button',{name:'Mark watched'}).click();
  await expect(page.getByText('100%',{exact:true})).toBeVisible();
  await page.reload();
  // Source selection deliberately does not persist; reselecting the source restores its saved checkpoints.
  await page.getByRole('textbox',{name:'YouTube video or playlist URL'}).fill('https://youtu.be/dQw4w9WgXcQ');
  await page.getByRole('button',{name:'Load link'}).click();
  await expect(page.getByText('Key point')).toBeVisible();
  await expect(page.getByText('100%',{exact:true})).toBeVisible();
});
test('PDF pages render in-browser and page bookmarks restore',async ({page})=>{
  await page.goto('/#studio'); await page.getByRole('tab',{name:'PDF reader'}).click();
  await page.getByLabel('Choose PDF file').setInputFiles({name:'sample.pdf',mimeType:'application/pdf',buffer:samplePdf()});
  await expect(page.getByText('Page 1 of 2')).toBeVisible({timeout:15000});
  await page.getByRole('button',{name:'Next PDF page'}).click();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await page.getByRole('textbox',{name:'Bookmark title'}).fill('Useful section');
  await page.getByRole('button',{name:'Save bookmark'}).click();
  await expect(page.getByText('Useful section')).toBeVisible();
  await expect(page.locator('canvas[aria-label="Rendered PDF page 2"]')).toBeVisible();
});
test('Audio lessons can be opened and marked complete without uploading',async ({page})=>{
  await page.goto('/#studio');await page.getByRole('tab',{name:'Audio lessons'}).click();
  await page.getByLabel('Choose audio file').setInputFiles({name:'sample.wav',mimeType:'audio/wav',buffer:sampleWav()});
  await expect(page.getByRole('heading',{name:'sample.wav'})).toBeVisible();
  await expect(page.getByLabel('Audio lesson player')).toBeVisible();
  await page.getByRole('button',{name:'Mark complete'}).click();
  await expect(page.getByText('100%',{exact:true})).toBeVisible();
});
test('Text-to-speech editing supports preferences, bookmarks and progress labels',async ({page})=>{
  await page.goto('/#studio');await page.getByRole('tab',{name:'Read aloud'}).click();
  await expect(page.getByRole('textbox',{name:'Text for narration'})).toBeVisible();
  await page.getByRole('textbox',{name:'Text for narration'}).fill('An original short practice lesson for audio-first learning.');
  await page.getByRole('combobox',{name:'Narration speed'}).selectOption('1.25');
  await page.getByRole('textbox',{name:'Bookmark title'}).fill('Return here');
  await page.getByRole('button',{name:'Save bookmark'}).click();
  await expect(page.getByText('Return here')).toBeVisible();
  await page.reload(); await page.getByRole('tab',{name:'Read aloud'}).click();
  await page.getByRole('textbox',{name:'Text for narration'}).fill('An original short practice lesson for audio-first learning.');
  await expect(page.getByText('Return here')).toBeVisible();
});
test('bookmarks synchronize between tabs in the same browser',async ({page,context})=>{
  await page.goto('/#studio');
  const second=await context.newPage();await second.goto('/#studio');
  await page.getByRole('textbox',{name:'Bookmark title'}).fill('Cross-tab checkpoint');
  await page.getByRole('button',{name:'Save bookmark'}).click();
  await expect(second.getByText('Cross-tab checkpoint')).toBeVisible();
  await second.close();
});
