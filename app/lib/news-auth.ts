import "server-only";
import type { NextRequest } from "next/server";
export function newsAdminAuthorized(request:NextRequest){ const expected=process.env.NEWS_ADMIN_SECRET||process.env.CONTENT_APPROVAL_SECRET; if(!expected)return false; return request.headers.get("x-news-admin-secret")===expected||request.headers.get("authorization")===`Bearer ${expected}`; }
