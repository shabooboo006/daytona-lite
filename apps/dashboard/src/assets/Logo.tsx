/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

const iconSegments = [
  { x: 21, y: 15, width: 10, height: 24 },
  { x: -5, y: -16, width: 10, height: 32, transform: 'translate(47 22) rotate(-45)' },
  { x: 55, y: 25, width: 26, height: 10 },
  { x: -5, y: -16, width: 10, height: 32, transform: 'translate(74 55) rotate(45)' },
  { x: 57, y: 61, width: 10, height: 24 },
  { x: -5, y: -16, width: 10, height: 32, transform: 'translate(40 75) rotate(-45)' },
  { x: 11, y: 63, width: 26, height: 10 },
  { x: -5, y: -16, width: 10, height: 32, transform: 'translate(14 52) rotate(45)' },
]

export function Logo() {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 100 100"
      fill="none"
      className="size-7 shrink-0"
    >
      <g fill="currentColor">
        {iconSegments.map((segment, index) => (
          <rect key={index} {...segment} />
        ))}
      </g>
    </svg>
  )
}

export function LogoText() {
  return (
    <div className="flex items-end gap-1.5 leading-none whitespace-nowrap">
      <span className="text-[1.125rem] font-semibold tracking-[-0.045em]">Daytona</span>
      <span className="pb-[0.12rem] text-[0.64rem] font-semibold uppercase tracking-[0.24em] opacity-65">Lite</span>
    </div>
  )
}
