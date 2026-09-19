import './localization';
import options from './options';
import { Roulette } from './roulette';

const roulette = new Roulette();

(window as any).roulette = roulette;
(window as any).options = options;

// 한 라운드의 시작을 감싼다. 지금은 녹화 준비만 하지만, 시작 직전에 끼워넣을
// 일이 생기면 여기에 붙이면 된다. index.html의 시작 버튼이 이걸 호출한다.
(window as any).round = {
  begin(onStart: () => void) {
    roulette.startRecording().then(() => onStart());
  },
};
