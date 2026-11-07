import { useRef, type ReactNode } from 'react'

export interface ChoiceCardOption {
  value: string
  title: string
  detail?: string
  icon?: ReactNode
  status?: ReactNode
  disabled?: boolean
}

interface ChoiceCardGroupProps {
  name: string
  legend: string
  options: ChoiceCardOption[]
  value: string
  onChange: (value: string) => void
}

export function ChoiceCardGroup({ name, legend, options, value, onChange }: ChoiceCardGroupProps) {
  const railRef = useRef<HTMLDivElement>(null)
  const layout = options.length >= 4 ? 'rail' : 'grid'

  function scrollRail(direction: -1 | 1) {
    const rail = railRef.current
    if (!rail) return
    rail.scrollBy({ left: direction * rail.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <fieldset className="choice-card-group" data-layout={layout}>
      <legend className="choice-card-group__legend">{legend}</legend>
      {layout === 'rail' && <button className="choice-card-group__scroll choice-card-group__scroll--previous" type="button" aria-label="이전 선택지" onClick={() => scrollRail(-1)}>‹</button>}
      <div className={`choice-card-group__options choice-card-group__options--${layout}`} ref={railRef}>
        {options.map((option) => (
          <label className="choice-card" key={option.value}>
            <input
              className="choice-card__radio"
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
            />
            <span className="choice-card__content">
              {option.icon && <span className="choice-card__icon" aria-hidden="true">{option.icon}</span>}
              <span className="choice-card__text">
                <strong>{option.title}</strong>
                {option.detail && <small>{option.detail}</small>}
              </span>
              {option.status && <span className="choice-card__status">{option.status}</span>}
            </span>
          </label>
        ))}
      </div>
      {layout === 'rail' && <button className="choice-card-group__scroll choice-card-group__scroll--next" type="button" aria-label="다음 선택지" onClick={() => scrollRail(1)}>›</button>}
    </fieldset>
  )
}
