import { useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { uid } from '../../model/types';
import { cloneProject } from '../../logic/grid';

export default function ImagesPanel() {
  const { state, mutate, toast } = useStore();
  const p = state.project;
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingAlt, setEditingAlt] = useState<string | null>(null);

  const upload = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!/image\/(jpeg|png|webp|svg\+xml)/.test(file.type)) {
        toast(`Tiedostoa ${file.name} ei tueta (JPEG, PNG tai WebP)`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        mutate((pr) => ({
          ...pr,
          images: [...pr.images, { id: uid('img'), name: file.name, dataUrl, alt: file.name.replace(/\.\w+$/, '') }],
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const recent = [...p.images].filter((i) => i.usedAt).sort((a, b) => (b.usedAt ?? 0) - (a.usedAt ?? 0)).slice(0, 4);

  return (
    <div className="panel">
      <h2 className="panel-title">Kuvat</h2>
      <div
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
      >
        <p>Pudota JPEG-, PNG- tai WebP-tiedostoja tähän</p>
        <button className="panel-btn" onClick={() => fileRef.current?.click()}>
          Lataa kuvia
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => upload(e.target.files)}
        />
      </div>

      <div className="panel-hint subtle">
        Vedä kuva ruudukon vihjealueelle liittääksesi sen. Prototyypin mallikuvat ovat alkuperäisiä
        piirroskuvituksia.
      </div>

      {recent.length > 0 && (
        <>
          <h3 className="panel-sub">Viimeksi käytetyt</h3>
          <div className="image-grid">
            {recent.map((img) => (
              <ImageThumb key={`r-${img.id}`} img={img} onAlt={() => setEditingAlt(img.id)} />
            ))}
          </div>
        </>
      )}

      <h3 className="panel-sub">Kaikki kuvat ({p.images.length})</h3>
      <div className="image-grid">
        {p.images.map((img) => (
          <div key={img.id} className="image-card">
            <ImageThumb img={img} onAlt={() => setEditingAlt(img.id)} />
            {editingAlt === img.id ? (
              <input
                className="alt-input"
                defaultValue={img.alt}
                autoFocus
                aria-label="Vaihtoehtoinen teksti"
                onBlur={(e) => {
                  const alt = e.target.value;
                  mutate((pr) => ({
                    ...pr,
                    images: pr.images.map((i) => (i.id === img.id ? { ...i, alt } : i)),
                  }));
                  setEditingAlt(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
            ) : (
              <button className="image-alt" onClick={() => setEditingAlt(img.id)} title="Muokkaa alt-tekstiä">
                {img.alt || 'Lisää alt-teksti'}
              </button>
            )}
            <button
              className="mini-btn image-remove"
              title="Poista kuva"
              onClick={() =>
                mutate((pr) => {
                  const n = cloneProject(pr);
                  n.images = n.images.filter((i) => i.id !== img.id);
                  n.regions = n.regions.map((rg) => (rg.imageId === img.id ? { ...rg, imageId: undefined } : rg));
                  return n;
                })
              }
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImageThumb({ img, onAlt }: { img: { id: string; dataUrl: string; alt: string; name: string }; onAlt: () => void }) {
  return (
    <img
      className="image-thumb"
      src={img.dataUrl}
      alt={img.alt}
      title={`${img.name} – vedä ruudukon alueelle`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('ristikkostudio/image-id', img.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onDoubleClick={onAlt}
    />
  );
}
