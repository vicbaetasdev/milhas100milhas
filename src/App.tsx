import { useMemo, useState, type FormEvent } from 'react'
import JSZip from 'jszip'
import logoUrl from './assets/logo.png'
import fundoUrl from './assets/fundo.png'
import './App.css'

type Ticket = {
  id: string
  from: string
  to: string
  miles: number
  approxReais: number
  dates: string[]
}

type GlobalConfig = {
  companhia: string
  valorMilheiro: number | null  // valor em R$ de 1.000 milhas
}



const milesFormatter = new Intl.NumberFormat('pt-BR')
const reaisFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
})

function toNumber(raw: string): number {
  const normalized = raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  return Number(normalized)
}

function parseTicketsFromText(rawText: string): Ticket[] {
  const normalizedText = rawText.replace(/\r\n/g, '\n')
  const pattern =
    /ID PASSAGEM:\s*(\d+)\s*\nDe:\s*([^\n]+)\s*\nPara:\s*([^\n]+)\s*\nA partir de:\s*([\d.]+)\s*milhas(?:\s*\nMais ou menos:\s*R\$\s*([\d.,]+))?(?:\s*\nDatas:\s*([^\n]+))?/g

  const parsed: Ticket[] = []
  for (const match of normalizedText.matchAll(pattern)) {
    const id = match[1].trim()
    const from = match[2].trim()
    const to = match[3].trim()
    const miles = Number(match[4].replace(/\./g, ''))
    const approxReais = match[5] ? toNumber(match[5]) : 0
    const datesRaw = match[6] ?? ''
    const dates = datesRaw
      ? datesRaw.split(',').map((d) => d.trim()).filter(Boolean).slice(0, 3)
      : []

    if (Number.isNaN(miles)) continue

    parsed.push({ id, from, to, miles, approxReais, dates })
  }

  return parsed
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Nao foi possivel gerar imagem do card.'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const resp = await fetch(src)
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ao carregar imagem`)
  const blob = await resp.blob()
  const objectUrl = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error(`Falha ao decodificar imagem: ${src}`)) }
    img.src = objectUrl
  })
}

// Rounded rect compatível com todos os browsers (não usa ctx.roundRect)
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// Draws text fitting within maxWidth, scaling font size down if needed
function fillFitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  baseFontSize: number,
  fontStyle: string,
) {
  let size = baseFontSize
  ctx.font = `${fontStyle} ${size}px "Barlow Condensed", sans-serif`
  while (ctx.measureText(text).width > maxWidth && size > 20) {
    size -= 4
    ctx.font = `${fontStyle} ${size}px "Barlow Condensed", sans-serif`
  }
  ctx.fillText(text, x, y)
}

async function createCardPng(
  ticket: Ticket,
  logo: HTMLImageElement,
  fundo: HTMLImageElement,
  config: GlobalConfig,
): Promise<Blob> {
  // Calcula reais: se valorMilheiro estiver definido, usa a fórmula; senão, usa o valor do texto
  const reais =
    config.valorMilheiro != null
      ? (ticket.miles / 1000) * config.valorMilheiro
      : ticket.approxReais
  const W = 1200
  const H = 1200
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nao suportado neste navegador.')

  // ── Borda: preenche o canvas inteiro com a cor da borda
  ctx.fillStyle = '#015659'
  ctx.fillRect(0, 0, W, H)

  // ── Painel branco (inset da borda)
  const border = 26
  const pX = border, pY = border, pW = W - border * 2, pH = H - border * 2, pR = 36
  ctx.fillStyle = '#ffffff'
  rrect(ctx, pX, pY, pW, pH, pR)
  ctx.fill()

  // ── Fundo (mapa-múndi) clipped ao painel — cover pela altura
  ctx.save()
  rrect(ctx, pX, pY, pW, pH, pR)
  ctx.clip()
  ctx.globalAlpha = 0.50
  const fScale = pH / fundo.naturalHeight
  const fDrawW = fundo.naturalWidth * fScale
  const fDrawH = pH
  const fDrawX = pX + (pW - fDrawW) / 2
  ctx.drawImage(fundo, fDrawX, pY, fDrawW, fDrawH)
  ctx.globalAlpha = 1
  ctx.restore()

  // ── Logo centralizada
  const logoW = 400
  const logoH = Math.round(logoW * (logo.naturalHeight / logo.naturalWidth))
  const logoX = (W - logoW) / 2
  const logoY = pY + 40
  ctx.drawImage(logo, logoX, logoY, logoW, logoH)

  const afterLogo = logoY + logoH + 30

  // ── ORIGEM / DESTINO
  const odLabelY = afterLogo + 46   // baseline das labels
  const odCityY = odLabelY + 112    // baseline das cidades
  const underlineY = odCityY + 18
  const innerLeft = pX + 52
  const innerRight = pX + pW - 52  // = 1120

  // Ícones + labels
  ctx.font = '700 38px "Barlow Condensed", sans-serif'
  ctx.fillStyle = '#667088'
  ctx.textAlign = 'left'
  ctx.fillText('ORIGEM:', innerLeft, odLabelY)

  ctx.textAlign = 'right'
  ctx.fillText('DESTINO:', innerRight, odLabelY)

  // Cidades
  ctx.fillStyle = '#11182e'
  ctx.textAlign = 'left'
  fillFitText(ctx, ticket.from.toUpperCase(), innerLeft, odCityY, 460, 90, '700')

  ctx.textAlign = 'right'
  fillFitText(ctx, ticket.to.toUpperCase(), innerRight, odCityY, 460, 90, '700')

  // Underlines
  ctx.fillStyle = '#211975'
  ctx.fillRect(innerLeft, underlineY, 80, 3)
  ctx.fillRect(innerRight - 80, underlineY, 80, 3)

  // Avião central
  ctx.fillStyle = '#1d5c45'
  ctx.font = '700 60px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('✈', W / 2, odCityY - 10)

  // ── Painel azul — CUSTO FINAL
  const blueTop = underlineY + 50
  const blueH = 300
  const blueLeft = innerLeft
  const blueW = pW - 104

  ctx.fillStyle = '#1a2060'
  rrect(ctx, blueLeft, blueTop, blueW, blueH, 36)
  ctx.fill()

  // Tag "CUSTO FINAL"
  const tagText = 'CUSTO FINAL'
  ctx.font = '700 30px "Barlow Condensed", sans-serif'
  const tagW = ctx.measureText(tagText).width + 56
  const tagH = 42
  const tagX = W / 2 - tagW / 2
  const tagY = blueTop - tagH / 2

  ctx.fillStyle = '#00c4c4'
  rrect(ctx, tagX, tagY, tagW, tagH, tagH / 2)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.font = '700 26px "Barlow Condensed", sans-serif'
  ctx.fillText(tagText, W / 2, tagY + 29)

  // Divisor pontilhado vertical
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 2
  ctx.setLineDash([10, 12])
  ctx.beginPath()
  ctx.moveTo(W / 2, blueTop + 36)
  ctx.lineTo(W / 2, blueTop + blueH - 36)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.lineWidth = 1

  // Coluna esquerda — EM REAIS (ESTIMADO)
  const colPad = 52
  const colLabelY = blueTop + 72
  const colValueY = blueTop + 196

  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '600 28px Manrope, sans-serif'
  ctx.fillText('EM REAIS (ESTIMADO)', blueLeft + colPad, colLabelY)

  ctx.fillStyle = '#ffffff'
  ctx.font = '800 82px "Barlow Condensed", sans-serif'
  ctx.fillText(reaisFormatter.format(reais), blueLeft + colPad, colValueY)

  // Coluna direita — EM MILHAS (right-aligned)
  const rightColX = blueLeft + blueW - colPad
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '600 28px Manrope, sans-serif'
  ctx.fillText('EM MILHAS', rightColX, colLabelY)

  ctx.fillStyle = '#ffffff'
  ctx.font = '800 82px "Barlow Condensed", sans-serif'
  ctx.fillText(
    `${milesFormatter.format(ticket.miles)} milhas`,
    rightColX,
    colValueY,
  )

  // Nota (left-aligned, alinhada com coluna esquerda)
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.38)'
  ctx.font = '500 22px Manrope, sans-serif'
  ctx.fillText('TAXA DE EMBARQUE NÃO INCLUSA', blueLeft + colPad, blueTop + blueH - 22)

  // ── DATAS DISPONÍVEIS
  const datasTop = blueTop + blueH + 44
  const numDates = ticket.dates.length

  ctx.fillStyle = '#171430'
  ctx.font = '700 36px "Barlow Condensed", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('DATAS DISPONÍVEIS:', innerLeft + 4, datasTop + 38)

  const boxH = 66
  const boxY = datasTop + 56
  const totalBoxW = pW - 104
  const boxGap = 22
  // Calcula boxW com base no número real de datas (mínimo 1)
  const numBoxes = Math.max(numDates, 1)
  const boxW = Math.floor((totalBoxW - (numBoxes - 1) * boxGap) / numBoxes)

  for (let i = 0; i < numDates; i++) {
    const bx = innerLeft + i * (boxW + boxGap)

    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#cfd5e6'
    ctx.lineWidth = 2
    rrect(ctx, bx, boxY, boxW, boxH, 12)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#171430'
    ctx.font = '700 34px "Barlow Condensed", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(ticket.dates[i], bx + boxW / 2, boxY + 44)
  }

  // ── Rodapé: companhia aérea
  if (config.companhia) {
    const footerY = boxY + boxH + 46
    ctx.textAlign = 'left'
    ctx.font = '700 34px "Barlow Condensed", sans-serif'
    ctx.fillStyle = '#55607a'
    ctx.fillText(`✈  COMPANHIA AÉREA: ${config.companhia.toUpperCase()}`, innerLeft, footerY)
  }

  return canvasToBlob(canvas)
}

async function buildCardsZip(tickets: Ticket[], config: GlobalConfig): Promise<Blob> {
  const [logo, fundo] = await Promise.all([loadImage(logoUrl), loadImage(fundoUrl)])
  const zip = new JSZip()

  for (const ticket of tickets) {
    const image = await createCardPng(ticket, logo, fundo, config)
    const fileName = `card-${ticket.id}-${ticket.from}-${ticket.to}`
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
    zip.file(`${fileName}.png`, image)
  }

  return zip.generateAsync({ type: 'blob' })
}

function parseMilheiro(raw: string): number | null {
  if (!raw.trim()) return null
  const n = Number(raw.trim().replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

function App() {
  const [formText, setFormText] = useState('')
  const [companhia, setCompanhia] = useState('')
  const [milheiro, setMilheiro] = useState('')
  const [parseError, setParseError] = useState('')
  const [parseSuccess, setParseSuccess] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  const parsedTickets = useMemo(() => parseTicketsFromText(formText), [formText])
  const valorMilheiro = useMemo(() => parseMilheiro(milheiro), [milheiro])

  const globalConfig: GlobalConfig = { companhia, valorMilheiro }

  const handleGenerate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!parsedTickets.length) {
      setParseError('Nao consegui interpretar o texto. Verifique se ele segue exatamente o formato enviado.')
      setParseSuccess('')
      return
    }

    setParseError('')
    setParseSuccess(`${parsedTickets.length} cards prontos para download.`)
  }

  const handleDownload = async () => {
    if (!parsedTickets.length) {
      setParseError('Nao consegui interpretar o texto. Verifique se ele segue exatamente o formato enviado.')
      setParseSuccess('')
      return
    }

    try {
      setIsDownloading(true)
      setParseError('')
      setParseSuccess('Gerando arquivo ZIP dos cards...')

      const zipBlob = await buildCardsZip(parsedTickets, globalConfig)
      const fileName = `cards-passagens-${new Date().toISOString().slice(0, 10)}.zip`
      downloadBlob(zipBlob, fileName)

      setParseSuccess(`${parsedTickets.length} cards baixados em ZIP com sucesso.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setParseError(`Falha ao gerar o download: ${msg}`)
      setParseSuccess('')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <main className="page-shell">
      <header className="hero-block">
        <p className="eyebrow">MILHAS 100 MILHAS</p>
        <h1>Gerador de Cards</h1>
        <p className="subtitle">
          Cole os dados das passagens no formato abaixo e baixe todos os cards em ZIP.
          O campo <strong>Datas:</strong> é opcional (até 3 datas separadas por vírgula).
        </p>
      </header>

      <section className="entry-panel" aria-labelledby="entry-title">
        <div className="entry-header">
          <h2 id="entry-title">Formulario em texto</h2>
          <p>Use o mesmo padrao: ID PASSAGEM, De, Para, A partir de, Mais ou menos e (opcional) Datas.</p>
        </div>

        <form className="ticket-form" onSubmit={handleGenerate}>
          <div className="global-config-row">
            <label className="global-config-field">
              <span className="global-config-label">Companhia Aérea</span>
              <input
                className="global-config-input"
                value={companhia}
                onChange={(e) => setCompanhia(e.target.value)}
                placeholder="Ex: LATAM"
              />
            </label>
            <label className="global-config-field">
              <span className="global-config-label">Valor do Milheiro (R$)</span>
              <input
                className="global-config-input"
                value={milheiro}
                onChange={(e) => setMilheiro(e.target.value)}
                placeholder="Ex: 25,00"
              />
              {valorMilheiro != null && (
                <span className="global-config-hint">
                  Reais = milhas ÷ 1.000 × R$ {valorMilheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              )}
            </label>
          </div>

          <div className="mago-hint">
            <span>Cole aqui a mensagem gerada pelo Mago das Milhas — </span>
            <a
              href="https://chatgpt.com/share/6a28b8ca-ec74-83e9-8511-e3dcb20f7f48"
              target="_blank"
              rel="noopener noreferrer"
            >
              clique aqui para acessar o GPT
            </a>
          </div>

          <label className="text-input-wrap">
            Dados das passagens
            <textarea
              value={formText}
              onChange={(event) => {
                setFormText(event.target.value)
                if (parseError) setParseError('')
                if (parseSuccess) setParseSuccess('')
              }}
              className="ticket-textarea"
              spellCheck={false}
              placeholder="Cole aqui a mensagem gerada pelo Mago das Milhas..."
            />
          </label>

          <div className="form-actions">
            <button type="submit">Gerar cards do texto</button>
            <button type="button" onClick={handleDownload} disabled={isDownloading}>
              {isDownloading ? 'Gerando ZIP...' : 'Baixar cards em ZIP'}
            </button>
          </div>
        </form>

        {parseError ? (
          <p className="parse-error" role="alert">
            {parseError}
          </p>
        ) : null}

        {parseSuccess ? (
          <p className="parse-success" role="status" aria-live="polite">
            {parseSuccess}
          </p>
        ) : null}
      </section>
    </main>
  )
}

export default App
