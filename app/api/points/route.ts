import { NextRequest, NextResponse } from 'next/server'
import { computePoints } from '../../lib/points'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')

    if (
      !process.env.DEV &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return new Response('Unauthorized', {
        status: 401
      })
    }

    // Extract `from` and `to` query parameters
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined

    const response = await computePoints(from, to)

    return Response.json({ success: true, response })
  } catch (error) {
    console.error('CRON error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}
