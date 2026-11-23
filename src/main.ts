import './style.css';
import { greeting } from './greeting';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('#app が見つかりません');
}

const heading = document.createElement('h1');
heading.textContent = greeting();
app.replaceChildren(heading);
