# AX Sprint Control Tower MVP v20

v19의 Supabase 공용DB와 기관용/관리자용 화면 구조를 유지하면서 요청·회신 운영을 확장한 버전입니다.

## v19에서 v20으로 업데이트

기존 데이터는 유지됩니다. Supabase에서 아래 SQL만 1회 추가 실행하십시오.

1. Supabase Dashboard → `SQL Editor` → `New query`
2. `supabase_update_v20.sql` 내용 전체 붙여넣기
3. `Run`
4. GitHub Pages의 웹 파일을 v20 파일로 교체

`supabase_update_v20.sql`은 복수 수신기관 요청과 기관별 개별 회신을 지원하는 RPC를 추가합니다.

## v20 주요 변경

- 기관 화면에서 `요청·회신`을 `전체 항목`보다 위에 배치
- 기관 화면 요청 보기: `전체 요청 / 받은 요청 / 보낸 요청`
- 요청 등록 시 수신기관 복수 선택
- `전체 요청` 선택 시 발신기관을 제외한 모든 기관 선택
- 복수 수신 요청은 하나의 요청으로 관리하며 기관별 회신을 각각 저장
- 관리자 `요청·회신` 메뉴에서 전체 요청 검색 및 기관·상태 필터
- 관리자가 요청 제목, 내용, 수신기관, 일정, 상태를 수정 가능
- 관리자가 기관별 회신내용, 회신일, 확인메모를 수정 가능
- 관리자가 기관별 회신만 삭제하거나 요청 전체를 삭제 가능

## 기존 설치가 없는 경우

새 Supabase 프로젝트라면 `supabase_setup.sql`을 1회 실행하면 됩니다. 이 파일에는 v20용 요청·회신 RPC도 포함되어 있습니다.

## GitHub Pages 공개 파일

- index.html
- junctionmed.html
- kyungbok.html
- carefuture.html
- aimlab.html
- styles.css
- app.js
- data.js
- supabase-config.js

SQL 파일은 GitHub Pages 공개 배포 대상에서 제외하는 것을 권장합니다.

## 기관별 링크

- 정션메드: `junctionmed.html`
- 경복대학교: `kyungbok.html`
- 돌봄과 미래: `carefuture.html`
- 에임랩: `aimlab.html`

모든 기관 화면과 관리자 화면은 동일한 Supabase `ax_project_state` 데이터를 사용합니다.
