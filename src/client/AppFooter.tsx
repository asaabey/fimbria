import type {ReactNode} from 'react';
import packageInfo from '../../package.json' with {type:'json'};

// npm versions use unpadded numbers; display the calendar month/day with two digits.
const appVersion=packageInfo.version.replace(/^(\d{4})\.(\d+)\.(\d+)/,(_match,year,month,day)=>`${year}.${month.padStart(2,'0')}.${day.padStart(2,'0')}`);

export function AppFooter({children='Fimbria · Live lessons, shared understanding.'}:{children?:ReactNode}){
  return <footer className="app-footer">
    <span>{children}</span>
    <span className="app-version" aria-label={`App version ${appVersion}`} title={`Fimbria version ${appVersion}`}>v{appVersion}</span>
  </footer>;
}
