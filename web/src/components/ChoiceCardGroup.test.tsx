import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { ChoiceCardGroup } from './ChoiceCardGroup'

const options = [
  { value: 'one', title: '첫 번째 이야기' },
  { value: 'two', title: '두 번째 이야기' },
  { value: 'three', title: '세 번째 이야기' },
]

function ChoiceHarness({ items = options }: { items?: typeof options }) {
  const [value, setValue] = useState(items[0].value)
  return <ChoiceCardGroup name="story" legend="이야기" options={items} value={value} onChange={setValue} />
}

describe('ChoiceCardGroup', () => {
  it('marks only the chosen card as selected', () => {
    render(<ChoiceHarness />)

    expect(screen.getByRole('radio', { name: '첫 번째 이야기' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '두 번째 이야기' })).not.toBeChecked()
  })

  it('supports arrow-key selection across options', async () => {
    const user = userEvent.setup()
    render(<ChoiceHarness />)

    screen.getByRole('radio', { name: '첫 번째 이야기' }).focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('radio', { name: '두 번째 이야기' })).toBeChecked()
  })

  it('uses a horizontal rail and named controls for four or more options', () => {
    render(<ChoiceHarness items={[...options, { value: 'four', title: '네 번째 이야기' }]} />)

    expect(screen.getByRole('group', { name: '이야기' })).toHaveAttribute('data-layout', 'rail')
    expect(screen.getByRole('button', { name: '이전 선택지' })).toBeVisible()
    expect(screen.getByRole('button', { name: '다음 선택지' })).toBeVisible()
  })
})
