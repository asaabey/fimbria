import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BodyText} from '../src/client/BodyText.js';
const html=(text:string)=>renderToStaticMarkup(createElement(BodyText,{text}));
describe('slide body text',()=>{
  it('turns dash, star and bullet lines into a list and keeps surrounding prose',()=>{
    expect(html('Check:\n- Airway\n* Breathing\n• Circulation\nThen reassess.')).toBe('<div class="body"><p>Check:</p><ul><li>Airway</li><li>Breathing</li><li>Circulation</li></ul><p>Then reassess.</p></div>');
  });
  it('numbers lists from their first number',()=>{
    expect(html('3. Third\n4) Fourth')).toBe('<div class="body"><ol start="3"><li>Third</li><li>Fourth</li></ol></div>');
  });
  it('leaves ordinary text, negative numbers and line breaks alone',()=>{
    expect(html('Line one\n-5 °C is cold\n\nLine three')).toBe('<div class="body"><p>Line one\n-5 °C is cold\n\nLine three</p></div>');
  });
  it('separates bullet and numbered lists that touch',()=>{
    expect(html('- a\n1. b')).toBe('<div class="body"><ul><li>a</li></ul><ol start="1"><li>b</li></ol></div>');
  });
  it('renders **bold** and ==highlight==, including inside list items and each other',()=>{
    expect(html('Check the **potassium** first.\n- ==ECG now==\n- **Treat ==urgently==**')).toBe('<div class="body"><p>Check the <strong>potassium</strong> first.</p><ul><li><mark>ECG now</mark></li><li><strong>Treat <mark>urgently</mark></strong></li></ul></div>');
  });
  it('leaves loose or unmatched markers as typed and never renders HTML',()=>{
    expect(html('a == b and c ** d')).toBe('<div class="body"><p>a == b and c ** d</p></div>');
    expect(html('**unclosed and ==open')).toBe('<div class="body"><p>**unclosed and ==open</p></div>');
    expect(html('**<b>x</b>**')).toBe('<div class="body"><p><strong>&lt;b&gt;x&lt;/b&gt;</strong></p></div>');
  });
  it('keeps emphasis within one line',()=>{
    expect(html('**start\nend**')).toBe('<div class="body"><p>**start\nend**</p></div>');
  });
});
