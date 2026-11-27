import { createSessionCookie, jsonResponse, readJsonBody } from '../_shared.js';

const EMPLOYEE_URL = 'https://opensheet.elk.sh/1eqVoLsZxGguEbRCC5rdI4iMVtQ7CK4T3uXRdx8zE3uw/EmployeeWeb';
const DEFAULT_LOGIN_LOG_URL = 'https://script.google.com/macros/s/AKfycbyx8Y6S7iYw95BBd8nHSJArEU_o25mSb7QuF7pxdInbGZOIkDaiQLiaBwHFkHiILQPg/exec';

function getValidPasswords(idRec) {
    const raw = String(idRec ?? '').trim();
    const digits = raw.replace(/\D/g, '');
    const source = digits.length >= 4 ? digits : raw;
    if (source.length < 4) return [];

    const last4 = source.slice(-4);
    const valid = [last4];

    const last2 = source.slice(-2);
    const d1 = parseInt(last2[0], 10);
    const d2 = parseInt(last2[1], 10);
    if (!Number.isNaN(d1) && !Number.isNaN(d2)) {
        const sumPadded = String(d1 + d2).padStart(2, '0');
        valid.push(`${last4}${sumPadded}`);
    }
    return valid;
}

export async function onRequestPost({ request, env, waitUntil }) {
    const parsed = await readJsonBody(request);
    if (parsed.error) return parsed.error;

    const username = String(parsed.data?.username ?? '').trim();
    const password = String(parsed.data?.password ?? '').trim();

    if (!username) {
        return jsonResponse({ error: 'กรุณากรอกรหัสพนักงาน (IDRec)' }, 400);
    }
    if (!password) {
        return jsonResponse({ error: 'กรุณากรอกรหัสผ่าน' }, 400);
    }

    const validPasswords = getValidPasswords(username);
    if (validPasswords.length === 0 || !validPasswords.includes(password)) {
        return jsonResponse({ error: 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' }, 401);
    }

    let employees;
    try {
        const response = await fetch(EMPLOYEE_URL, {
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
            return jsonResponse({ error: `ไม่สามารถตรวจสอบพนักงานได้ (HTTP ${response.status})` }, 502);
        }
        employees = await response.json();
    } catch (error) {
        console.error('Employee lookup failed:', error);
        return jsonResponse({ error: 'ไม่สามารถเชื่อมต่อข้อมูลพนักงานได้' }, 502);
    }

    const user = Array.isArray(employees)
        ? employees.find(
            (employee) =>
                String(employee.IDRec ?? '').trim().toLowerCase() === username.toLowerCase()
        )
        : null;

    if (!user) {
        return jsonResponse({ error: 'ไม่พบข้อมูลพนักงาน (IDRec) นี้ในระบบ EmployeeWeb' }, 401);
    }

    const logUrl = env?.LOGIN_LOG_URL || DEFAULT_LOGIN_LOG_URL;
    if (logUrl) {
        waitUntil((async () => {
            try {
                const response = await fetch(logUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({
                        action: 'login',
                        userId: user.IDRec,
                        userName: user.Name,
                        userPlant: user.Plant || '-',
                        status: 'SUCCESS'
                    })
                });
                if (!response.ok) {
                    console.warn('Login log endpoint returned HTTP', response.status);
                }
            } catch (error) {
                console.warn('Login logging failed:', error);
            }
        })());
    }

    const sessionCookie = await createSessionCookie(request, env, user);
    return jsonResponse(user, 200, {
        'Set-Cookie': sessionCookie
    });
}
