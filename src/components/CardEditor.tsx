import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import logoUrl from '../assets/logo.png'
import './CardEditor.css'

type CardData = {
  origem: string
  destino: string
  custoReais: string
  custoMilhas: string
  data1: string
  data2: string
  data3: string
  companhia: string
  programa: string
}

const empty: CardData = {
  origem: '',
  destino: '',
  custoReais: '',
  custoMilhas: '',
  data1: '',
  data2: '',
  data3: '',
  companhia: '',
  programa: '',
}

function CardPreview({ data }: { data: CardData }) {
  return (
    <div className="cp-card">
      <div className="cp-map-bg" aria-hidden="true" />

      {/* Logo */}
      <div className="cp-logo">
        <img src={logoUrl} alt="Milhas 100 Milhas" className="cp-logo-img" />
      </div>

      {/* Origem / Destino */}
      <div className="cp-od">
        <div className="cp-od-block">
          <div className="cp-od-header">
            <span className="cp-od-icon">🗺️</span>
            <span className="cp-od-label">ORIGEM:</span>
          </div>
          <div className="cp-od-field">{data.origem}</div>
          <div className="cp-od-line" />
        </div>

        <div className="cp-od-arrow" aria-hidden="true">✈</div>

        <div className="cp-od-block cp-od-block--right">
          <div className="cp-od-header">
            <span className="cp-od-icon">📍</span>
            <span className="cp-od-label">DESTINO:</span>
          </div>
          <div className="cp-od-field">{data.destino}</div>
          <div className="cp-od-line" />
        </div>
      </div>

      {/* Custo Final */}
      <div className="cp-custo-wrap">
        <div className="cp-custo-tag">CUSTO FINAL</div>
        <div className="cp-custo-panel">
          <div className="cp-custo-cols">
            <div className="cp-custo-col">
              <div className="cp-custo-col-label">EM REAIS (ESTIMADO)</div>
              <div className="cp-custo-col-value">{data.custoReais}</div>
            </div>
            <div className="cp-custo-sep" />
            <div className="cp-custo-col">
              <div className="cp-custo-col-label">EM MILHAS</div>
              <div className="cp-custo-col-value">{data.custoMilhas}</div>
            </div>
          </div>
          <div className="cp-custo-note">TAXA DE EMBARQUE NÃO INCLUSA</div>
        </div>
      </div>

      {/* Datas Disponíveis */}
      <div className="cp-datas">
        <div className="cp-datas-header">
          <span className="cp-datas-icon">📅</span>
          <span className="cp-datas-label">DATAS DISPONÍVEIS:</span>
        </div>
        <div className="cp-datas-row">
          <div className="cp-data-box">{data.data1}</div>
          <div className="cp-data-box">{data.data2}</div>
          <div className="cp-data-box">{data.data3}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="cp-footer">
        <div className="cp-footer-item">
          <span className="cp-footer-icon">✈</span>
          <span className="cp-footer-label">COMPANHIA AÉREA:</span>
          {data.companhia && <span className="cp-footer-value"> {data.companhia}</span>}
        </div>
        <div className="cp-footer-item">
          <span className="cp-footer-icon">📋</span>
          <span className="cp-footer-label">PROGRAMA:</span>
          {data.programa && <span className="cp-footer-value"> {data.programa}</span>}
        </div>
      </div>
    </div>
  )
}

export default function CardEditor() {
  const [data, setData] = useState<CardData>(empty)
  const [status, setStatus] = useState('')
  const [exporting, setExporting] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  const set = (field: keyof CardData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setData((prev) => ({ ...prev, [field]: e.target.value }))

  const handleExport = async () => {
    if (!previewRef.current) return
    setExporting(true)
    setStatus('Gerando imagem...')
    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      })
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      const origem = (data.origem || 'origem').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')
      const destino = (data.destino || 'destino').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')
      a.href = url
      a.download = `card-${origem}-${destino}.png`
      a.click()
      setStatus('Card exportado com sucesso!')
    } catch {
      setStatus('Erro ao exportar. Tente novamente.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="ce-root">
      {/* Form */}
      <div className="ce-form-panel">
        <h2 className="ce-form-title">Preencher Card</h2>

        <div className="ce-field-group">
          <label className="ce-label">
            Origem
            <input className="ce-input" value={data.origem} onChange={set('origem')} placeholder="Ex: São Paulo" />
          </label>
          <label className="ce-label">
            Destino
            <input className="ce-input" value={data.destino} onChange={set('destino')} placeholder="Ex: Madri" />
          </label>
        </div>

        <div className="ce-field-group">
          <label className="ce-label">
            Em Reais (estimado)
            <input className="ce-input" value={data.custoReais} onChange={set('custoReais')} placeholder="R$ 1.200,00" />
          </label>
          <label className="ce-label">
            Em Milhas
            <input className="ce-input" value={data.custoMilhas} onChange={set('custoMilhas')} placeholder="65.000" />
          </label>
        </div>

        <p className="ce-group-title">Datas Disponíveis</p>
        <div className="ce-field-group ce-field-group--3">
          <label className="ce-label">
            Data 1
            <input className="ce-input" value={data.data1} onChange={set('data1')} placeholder="15/07" />
          </label>
          <label className="ce-label">
            Data 2
            <input className="ce-input" value={data.data2} onChange={set('data2')} placeholder="22/07" />
          </label>
          <label className="ce-label">
            Data 3
            <input className="ce-input" value={data.data3} onChange={set('data3')} placeholder="29/07" />
          </label>
        </div>

        <div className="ce-field-group">
          <label className="ce-label">
            Companhia Aérea
            <input className="ce-input" value={data.companhia} onChange={set('companhia')} placeholder="LATAM" />
          </label>
          <label className="ce-label">
            Programa
            <input className="ce-input" value={data.programa} onChange={set('programa')} placeholder="LATAM Pass" />
          </label>
        </div>

        <button className="ce-btn" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exportando...' : 'Exportar como PNG'}
        </button>

        {status && <p className="ce-status">{status}</p>}
      </div>

      {/* Preview */}
      <div className="ce-preview-panel">
        <h2 className="ce-form-title">Preview</h2>
        <div ref={previewRef} className="ce-preview-box">
          <CardPreview data={data} />
        </div>
      </div>
    </div>
  )
}
