'use client'

/**
 * Figma node 47:40 — body only (y ≥ 91px); nav lives in Navbar.
 * Scales to fit the hero shell without horizontal overflow.
 */
import { FIGMA_LANDING } from '@/lib/figma-landing-constants'
import * as Assets from '@/lib/figma-landing-assets'
import Link from 'next/link'
import { useLayoutEffect, useRef, useState } from 'react'

const { bodyWidth: W, bodyHeight: H } = FIGMA_LANDING

function FigmaImg({
  src,
  alt,
  className,
  nodeId,
  constellation = true,
}: {
  src: string
  alt: string
  className?: string
  nodeId: string
  /** Graph nodes/lines only — not CTA star asset */
  constellation?: boolean
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={`${constellation ? 'figma-constellation-asset ' : ''}${className ?? ''}`}
      data-node-id={nodeId}
    />
  )
}

export function FigmaDesktop47_40() {
  const shellRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = shellRef.current
    if (!el) return

    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width <= 0 || height <= 0) return
      const s = Math.min(width / W, height / H, 1)
      setScale(s)
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div
      ref={shellRef}
      className="figma-landing relative flex h-full min-h-0 w-full max-w-[100vw] flex-col overflow-hidden bg-[var(--figma-landing-bg)] text-[var(--figma-landing-text)]"
      data-name="Desktop - 2"
      data-node-id="47:40"
    >
      <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden">
        <div
          className="relative shrink-0"
          style={{
            width: W * scale,
            height: H * scale,
          }}
        >
          <div
            className="absolute top-0 left-0 origin-top-left will-change-transform"
            style={{
              width: W,
              height: H,
              transform: `scale(${scale})`,
            }}
          >
            {/* 58:43 — gradient (Rectangle 4); bottom corners 32px per spec */}
            <div
              className="figma-landing-gradient -translate-x-1/2 absolute top-[372px] left-1/2 z-0 h-[561px] w-[1150px]"
              data-node-id="58:43"
            />

            <p
              className="absolute top-[133px] left-[calc(50%-582px)] h-[65px] w-[694px] text-[clamp(1.75rem,4.4vw,4rem)] leading-none font-semibold not-italic sm:text-[64px] sm:leading-normal"
              style={{ fontFamily: 'Sohne, sans-serif' }}
              data-node-id="47:42"
            >
              Map your relationships
            </p>

            <Link
              href="/signup"
              className="absolute top-[240px] left-[138px] z-20 flex h-[48px] w-[146px] items-center justify-center gap-1.5 rounded-[20px] bg-[var(--figma-landing-btn-bg)] pl-3 text-[20px] leading-normal font-medium text-[var(--figma-landing-btn-fg)] not-italic"
              style={{ fontFamily: 'Inter, sans-serif' }}
              data-node-id="47:47"
            >
              <span className="relative size-[10px] shrink-0" aria-hidden data-node-id="47:48">
                <FigmaImg
                  src={Assets.imgStar2}
                  alt=""
                  className="absolute block size-full max-w-none"
                  nodeId="47:48"
                  constellation={false}
                />
              </span>
              start now
            </Link>

            <p
              className="absolute top-[249px] left-[313px] z-10 h-[23px] w-[344px] text-[20px] leading-[0] font-medium not-italic text-[var(--figma-landing-text)]"
              style={{ fontFamily: 'Inter, sans-serif' }}
              data-node-id="47:50"
            >
              <span className="leading-normal">{`Already have an account? `}</span>
              <Link
                href="/login"
                className="leading-normal underline decoration-solid [text-decoration-skip-ink:none]"
                data-node-id="47:50-link"
              >
                Sign in
              </Link>
            </p>

            <div className="absolute top-[518px] left-[244px] z-10 size-[31px]" data-node-id="47:53">
              <FigmaImg
                src={Assets.imgEllipse2}
                alt=""
                className="absolute block size-full max-w-none"
                nodeId="47:53"
              />
            </div>
            <div className="absolute top-[722px] left-[343px] z-10 size-[31px]" data-node-id="55:42">
              <FigmaImg
                src={Assets.imgEllipse2}
                alt=""
                className="absolute block size-full max-w-none"
                nodeId="55:42"
              />
            </div>
            <div className="absolute top-[756px] left-[310px] z-10 size-[31px]" data-node-id="55:44">
              <FigmaImg
                src={Assets.imgEllipse2}
                alt=""
                className="absolute block size-full max-w-none"
                nodeId="55:44"
              />
            </div>
            <div className="absolute top-[885px] left-[220px] z-10 size-[31px]" data-node-id="55:46">
              <FigmaImg
                src={Assets.imgEllipse2}
                alt=""
                className="absolute block size-full max-w-none"
                nodeId="55:46"
              />
            </div>
            <div className="absolute top-[722px] left-[594px] z-10 size-[31px]" data-node-id="55:48">
              <FigmaImg
                src={Assets.imgEllipse2}
                alt=""
                className="absolute block size-full max-w-none"
                nodeId="55:48"
              />
            </div>
            <div className="absolute top-[786px] left-[594px] z-10 size-[31px]" data-node-id="55:50">
              <FigmaImg
                src={Assets.imgEllipse2}
                alt=""
                className="absolute block size-full max-w-none"
                nodeId="55:50"
              />
            </div>
            <div className="absolute top-[421px] left-[499px] z-10 size-[30px]" data-node-id="47:54">
              <FigmaImg
                src={Assets.imgEllipse6}
                alt=""
                className="absolute block size-full max-w-none"
                nodeId="47:54"
              />
            </div>
            <div className="absolute top-[476px] left-[680px] z-10 size-[31px]" data-node-id="47:55">
              <FigmaImg
                src={Assets.imgEllipse2}
                alt=""
                className="absolute block size-full max-w-none"
                nodeId="47:55"
              />
            </div>
            <div className="absolute top-[437px] left-[272px] z-10 flex h-[87.755px] w-[227px] items-center justify-center">
              <div className="flex-none rotate-[-21.14deg]">
                <div className="relative h-0 w-[243.372px]" data-node-id="54:10">
                  <div className="absolute inset-[-0.5px_0_0_0]">
                    <FigmaImg
                      src={Assets.imgLine8}
                      alt=""
                      className="block size-full max-w-none"
                      nodeId="54:10"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute top-[421px] left-[554px] z-10 size-[30px]" data-node-id="47:56">
              <FigmaImg
                src={Assets.imgEllipse6}
                alt=""
                className="absolute block size-full max-w-none"
                nodeId="47:56"
              />
            </div>
            <div className="absolute top-[606.28px] left-[364px] z-10 flex h-[116.719px] w-[16.97px] items-center justify-center">
              <div className="flex-none rotate-[98.27deg]">
                <div className="relative h-0 w-[117.946px]" data-node-id="47:59">
                  <div className="absolute inset-[-0.5px_0_0_0]">
                    <FigmaImg
                      src={Assets.imgLine2}
                      alt=""
                      className="block size-full max-w-none"
                      nodeId="47:59"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute top-[579px] left-[371px] z-10 size-[30px]" data-node-id="54:2">
              <FigmaImg
                src={Assets.imgEllipse7}
                alt=""
                className="absolute block size-full max-w-none"
                nodeId="54:2"
              />
            </div>
            <div className="absolute top-[540px] left-[275px] z-10 flex h-[50px] w-[96px] items-center justify-center">
              <div className="flex-none rotate-[27.51deg]">
                <div className="relative h-0 w-[108.24px]" data-node-id="54:4">
                  <div className="absolute inset-[-0.5px_0_0_0]">
                    <FigmaImg
                      src={Assets.imgLine6}
                      alt=""
                      className="block size-full max-w-none"
                      nodeId="54:4"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute top-[749px] left-[335.77px] z-10 flex h-[11.501px] w-[13.451px] items-center justify-center">
              <div className="flex-none rotate-[-39.29deg]">
                <div className="relative h-[1.935px] w-[15.797px]" data-node-id="47:62">
                  <div className="absolute inset-[-12.82%_-0.19%]">
                    <FigmaImg
                      src={Assets.imgLine4}
                      alt=""
                      className="block size-full max-w-none"
                      nodeId="47:62"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute top-[784px] left-[241px] z-10 flex h-[104px] w-[74.701px] items-center justify-center">
              <div className="flex-none rotate-[125.69deg]">
                <div className="relative h-0 w-[128.048px]" data-node-id="47:60">
                  <div className="absolute inset-[-0.5px_0_0_0]">
                    <FigmaImg
                      src={Assets.imgLine3}
                      alt=""
                      className="block size-full max-w-none"
                      nodeId="47:60"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute top-[654px] left-[865px] z-10 flex size-[19px] items-center justify-center">
              <div className="-scale-y-100 flex-none">
                <div className="relative size-[19px]" data-node-id="55:29">
                  <FigmaImg
                    src={Assets.imgEllipse8}
                    alt=""
                    className="absolute block size-full max-w-none"
                    nodeId="55:29"
                  />
                </div>
              </div>
            </div>
            <div className="absolute top-[661px] left-[586px] z-10 flex size-[20px] items-center justify-center">
              <div className="-scale-y-100 flex-none">
                <div className="relative size-[20px]" data-node-id="55:30">
                  <FigmaImg
                    src={Assets.imgEllipse9}
                    alt=""
                    className="absolute block size-full max-w-none"
                    nodeId="55:30"
                  />
                </div>
              </div>
            </div>
            <div className="absolute top-[812px] left-[1066px] z-10 flex size-[19px] items-center justify-center">
              <div className="-scale-y-100 flex-none">
                <div className="relative size-[19px]" data-node-id="55:33">
                  <FigmaImg
                    src={Assets.imgEllipse8}
                    alt=""
                    className="absolute block size-full max-w-none"
                    nodeId="55:33"
                  />
                </div>
              </div>
            </div>
            <div className="absolute top-[477px] left-[595.9px] z-10 flex size-[39.509px] items-center justify-center">
              <div className="flex-none rotate-[66.37deg]">
                <div className="relative size-[30px]" data-node-id="55:34">
                  <FigmaImg
                    src={Assets.imgEllipse11}
                    alt=""
                    className="absolute block size-full max-w-none"
                    nodeId="55:34"
                  />
                </div>
              </div>
            </div>
            <div className="absolute top-[436px] left-[529px] z-10 h-0 w-[25px]" data-node-id="57:3">
              <div className="absolute inset-[-0.5px_0_0_0]">
                <FigmaImg
                  src={Assets.imgLine13}
                  alt=""
                  className="block size-full max-w-none"
                  nodeId="57:3"
                />
              </div>
            </div>
            <div className="absolute top-[445px] left-[581px] z-10 flex h-[38px] w-[29px] items-center justify-center">
              <div className="flex-none rotate-[52.65deg]">
                <div className="relative h-0 w-[47.802px]" data-node-id="57:4">
                  <div className="absolute inset-[-0.5px_0_0_0]">
                    <FigmaImg
                      src={Assets.imgLine14}
                      alt=""
                      className="block size-full max-w-none"
                      nodeId="57:4"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute top-[492px] left-[631px] z-10 flex h-[3px] w-[49px] items-center justify-center">
              <div className="flex-none rotate-[-3.5deg]">
                <div className="relative h-0 w-[49.092px]" data-node-id="57:6">
                  <div className="absolute inset-[-0.5px_0_0_0]">
                    <FigmaImg
                      src={Assets.imgLine15}
                      alt=""
                      className="block size-full max-w-none"
                      nodeId="57:6"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute top-[510px] left-[596px] z-10 flex h-[151px] w-[13px] items-center justify-center">
              <div className="flex-none rotate-[94.92deg]">
                <div className="relative h-0 w-[151.559px]" data-node-id="57:7">
                  <div className="absolute inset-[-0.5px_0_0_0]">
                    <FigmaImg
                      src={Assets.imgLine16}
                      alt=""
                      className="block size-full max-w-none"
                      nodeId="57:7"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute top-[681px] left-[597px] z-10 flex h-[41px] w-[9px] items-center justify-center">
              <div className="flex-none rotate-[77.62deg]">
                <div className="relative h-0 w-[41.976px]" data-node-id="57:8">
                  <div className="absolute inset-[-0.5px_0_0_0]">
                    <FigmaImg
                      src={Assets.imgLine17}
                      alt=""
                      className="block size-full max-w-none"
                      nodeId="57:8"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute top-[752px] left-[609px] z-10 flex h-[34px] w-0 items-center justify-center">
              <div className="flex-none rotate-90">
                <div className="relative h-0 w-[34px]" data-node-id="57:9">
                  <div className="absolute inset-[-0.5px_0_0_0]">
                    <FigmaImg
                      src={Assets.imgLine18}
                      alt=""
                      className="block size-full max-w-none"
                      nodeId="57:9"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute top-[499px] left-[708px] z-10 flex h-[159.419px] w-[158.41px] items-center justify-center">
              <div className="flex-none rotate-[45.18deg]">
                <div className="relative h-0 w-[224.74px]" data-node-id="57:10">
                  <div className="absolute inset-[-0.5px_0_0_0]">
                    <FigmaImg
                      src={Assets.imgLine19}
                      alt=""
                      className="block size-full max-w-none"
                      nodeId="57:10"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute top-[669px] left-[882px] z-10 flex h-[147.158px] w-[185.778px] items-center justify-center">
              <div className="flex-none rotate-[38.38deg]">
                <div className="relative h-0 w-[237px]" data-node-id="57:11">
                  <div className="absolute inset-[-0.5px_0_0_0]">
                    <FigmaImg
                      src={Assets.imgLine20}
                      alt=""
                      className="block size-full max-w-none"
                      nodeId="57:11"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
