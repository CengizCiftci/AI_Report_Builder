# SQL Builder - ChatGPT Destekli Rapor Planlama (MVP)

Bu repo, doğal dilde alınan rapor isteğini `REPORT Plan` JSON'una çeviren ve bu planı güvenli/deterministic SQL'e dönüştüren bir başlangıç iskeletidir.

## Teknoloji
- Frontend: Next.js + Material UI
- Backend: Node.js + Express
- Database: PostgreSQL

## Klasör Yapısı
- `/frontend`: Login + rapor planlama ekranı
- `/backend`: Auth, dictionary, report plan, SQL builder API
- `/db`: PostgreSQL schema ve seed dosyaları

## Hızlı Başlangıç
1. PostgreSQL başlat:
   - `docker compose up -d`
2. Backend ortam dosyası:
   - `cp backend/.env.example backend/.env`
3. Frontend ortam dosyası:
   - `cp frontend/.env.example frontend/.env.local`
4. Backend çalıştır:
   - `cd backend && npm install && npm run dev`
5. Frontend çalıştır:
   - `cd frontend && npm install && npm run dev`

## Demo Kullanıcılar
- `superadmin / admin123`
- `teacher_ayse / teacher123`

Not: Seed içinde demo amaçlı düz metin parola kullanılıyor. Üretimde bcrypt hash kullanın.

## API Özeti
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dictionary`
- `POST /api/reports/plan`
- `POST /api/reports/execute`
- `POST /api/speech/transcribe`

## Güvenlik Prensipleri
- LLM sadece plan üretir; SQL üretimi backend'de whitelist metadata ile yapılır.
- Tüm sorgular parameterized (`$1, $2...`).
- Kullanıcı scope'u (`school_id`, `grade_level`, `course_id`, `teacher_id`) zorunlu filtre olarak uygulanır.
- LLM çıktısı Zod ile doğrulanır.


## Örnek Sorgular

- `List schools`

- `List students by grade, course session, and school` 

- `List of 9th grade students`
   |- **call for admin and teachers separetly. It should return different results**

- `For the fall semester, provide the attendance rate and the number of students by course for 9th grade.` (Clarification question for fall semester)
   |- **will ask for exact date range, won't accept informal description**

- `For the fall semester, provide the absenteeism rate and the number of students by course for 9th grade.` (Clarification question sorar)
   |- **Unsupported metric: absenteeism_rate**


## Örnek Sorgular Turkce
- `9. sınıf öğrenci listesi`

- `Sonbahar dönemi için 9. sınıf bazında derslere göre devamsızlık oranı ve öğrenci sayısını getir.` (Clarification question sorar)
