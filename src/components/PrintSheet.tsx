import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { buildSvg } from '../logic/exporter';

export interface PrintRequest {
  includeAnswers: boolean;
  answersOnSeparatePage: boolean;
  grayscale: boolean;
  includeTitle: boolean;
  includeIntro: boolean;
  includeAuthor: boolean;
}

let trigger: ((req: PrintRequest) => void) | null = null;

/** Käynnistää selaimen tulostuksen erillisellä tulostusarkilla. */
export function requestPrint(req: PrintRequest) {
  trigger?.(req);
}

export default function PrintSheet() {
  const { state } = useStore();
  const [req, setReq] = useState<PrintRequest | null>(null);

  useEffect(() => {
    trigger = (r) => setReq(r);
    return () => {
      trigger = null;
    };
  }, []);

  useEffect(() => {
    if (!req) return;
    const t = window.setTimeout(() => {
      window.print();
      setReq(null);
    }, 120);
    return () => window.clearTimeout(t);
  }, [req]);

  if (!req) return null;
  const p = state.project;
  const base = { grayscale: req.grayscale, includeTitle: req.includeTitle, includeIntro: req.includeIntro, includeAuthor: req.includeAuthor };
  const puzzleSvg = buildSvg(p, { ...base, showSolution: false });
  const keySvg = req.includeAnswers ? buildSvg(p, { ...base, showSolution: true }) : null;

  return (
    <div className="print-sheet">
      <div className="print-page" dangerouslySetInnerHTML={{ __html: puzzleSvg }} />
      {keySvg && (
        <div className={`print-page ${req.answersOnSeparatePage ? 'page-break' : ''}`}>
          <h2 className="print-key-title">RATKAISU</h2>
          <div dangerouslySetInnerHTML={{ __html: keySvg }} />
        </div>
      )}
    </div>
  );
}
