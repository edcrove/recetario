import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '../components/ErrorBoundary'

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom')
  return <>ok</>
}

describe('ErrorBoundary', () => {
  const originalError = console.error
  beforeEach(() => {
    console.error = vi.fn()
  })
  afterEach(() => {
    console.error = originalError
  })

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <>hijo normal</>
      </ErrorBoundary>,
    )
    expect(screen.getByText('hijo normal')).toBeInTheDocument()
  })

  it('renders the fallback UI when a child throws during render', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument()
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument()
  })

  it('logs the error via console.error', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(console.error).toHaveBeenCalledWith(
      'Unhandled render error:',
      expect.any(Error),
      expect.anything(),
    )
  })

  it('resets and re-renders children after tapping Reintentar', () => {
    let shouldThrow = true
    function Toggle() {
      return <Bomb shouldThrow={shouldThrow} />
    }
    render(
      <ErrorBoundary>
        <Toggle />
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument()

    shouldThrow = false
    fireEvent.click(screen.getByTestId('error-boundary-retry'))

    expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument()
    expect(screen.getByText('ok')).toBeInTheDocument()
  })
})
