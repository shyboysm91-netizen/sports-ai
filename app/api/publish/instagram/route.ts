import { NextResponse } from 'next/server';

export async function POST() {
  if (!process.env.META_ACCESS_TOKEN || !process.env.INSTAGRAM_USER_ID) return NextResponse.json({error:'Meta 연동 정보가 없습니다.'},{status:400});
  return NextResponse.json({ok:false, message:'카드 이미지의 공개 URL 저장소 연결 후 Instagram carousel publishing을 활성화합니다.'},{status:501});
}
