import { getPointsData } from '@/app/queries/sql'
import { NextRequest, NextResponse } from 'next/server'

type Props = {
  params: Promise<{
    address: string
  }>
}

export async function GET(request: NextRequest, { params }: Props) {
  const { address } = await params

  // Extract `from` and `to` query parameters
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') || undefined
  const to = searchParams.get('to') || undefined

  try {
    const results = await getPointsData(address, from, to)
    return NextResponse.json(results, { status: 200 })
  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}
