import type {LessonTable as Table} from '../shared/contracts.js';

// Wide tables scroll inside their own focusable region so the page never scrolls sideways on phones.
// Short values ("6.8 mmol/L") stay on one line; longer prose cells wrap.
const short=(cell:string|number)=>String(cell).length<=24;
export function LessonTable({table,compact=false}:{table:Table;compact?:boolean}){
  const label=table.caption||(table.columns?`Table: ${table.columns.join(', ')}`:'Table');
  return <div className={compact?'lesson-table compact':'lesson-table'} role="region" aria-label={label} tabIndex={0}>
    <table>
      {table.caption&&<caption>{table.caption}</caption>}
      {table.columns&&<thead><tr>{table.columns.map((c,i)=><th key={i} scope="col" className={short(c)?'nowrap':undefined}>{c}</th>)}</tr></thead>}
      <tbody>{table.rows.map((row,r)=><tr key={r}>{row.map((cell,c)=>table.rowHeaders&&c===0
        ?<th key={c} scope="row" className={short(cell)?'nowrap':undefined}>{cell}</th>
        :<td key={c} className={short(cell)?'nowrap':undefined}>{cell}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}
