# AX Sprint Control Tower MVP v19

v18의 일정/세부항목 편집과 Supabase 공유DB 구조를 유지하고, 기관 화면에 실제 소통 기능을 전면 배치한 버전입니다.

## v18에서 v19로 업데이트하는 경우

이미 v18의 `supabase_setup.sql`을 실행했다면 전체 설정을 다시 실행할 필요가 없습니다.

1. Supabase Dashboard → `SQL Editor` → `New query`
2. `supabase_update_v19.sql` 내용을 전체 복사
3. `Run` 실행
4. GitHub Pages 파일을 v19 파일로 교체

이 SQL은 기관이 직접 요청사항을 등록할 수 있는 `ax_portal_create_request` 함수만 추가합니다. 기존 데이터는 삭제하지 않습니다.

## 기관 화면 소통 기능

기관 화면 상단에 `협업 소통` 영역이 표시됩니다.

- `요청 보내기`: 현재 기관이 정션메드 또는 다른 기관에 요청사항 전달
- `받은 요청`: 해당 기관으로 들어온 요청 확인 및 회신 작성
- `보낸 요청`: 해당 기관이 보낸 요청과 상대 기관 회신 확인
- `협의사항 작성`: 정식 요청으로 분류하기 어려운 확인·협의 내용을 대화형으로 기록
- 상세 현황의 `요청·회신`, `협의사항` 탭에서 전체 이력 확인

요청을 등록하면 수신기관 화면에 동일 데이터가 표시되고, 수신기관이 회신하면 발신기관의 `보낸 요청`에도 회신내용이 표시됩니다. 관리자 `요청·회신 관리`에도 동일하게 표시됩니다.

## 신규 설치인 경우

새 Supabase 프로젝트라면 `supabase_setup.sql`을 한 번 실행하십시오. v19 전체 RPC가 포함되어 있습니다.

## GitHub Pages에 올릴 파일

- index.html
- junctionmed.html
- kyungbok.html
- carefuture.html
- aimlab.html
- styles.css
- app.js
- data.js
- supabase-config.js

다음 SQL 파일은 GitHub Pages 공개 배포 대상에서 제외하는 것을 권장합니다.

- supabase_setup.sql
- supabase_update_v19.sql

## 기관별 링크

- 정션메드: `junctionmed.html`
- 경복대학교: `kyungbok.html`
- 돌봄과 미래: `carefuture.html`
- 에임랩: `aimlab.html`

모든 기관 및 관리자 화면은 동일한 Supabase `ax_project_state` 데이터를 사용합니다.

## 관리자

기관 요청·회신은 관리자 화면의 `요청·회신` 메뉴에 자동 반영됩니다. 협의사항은 `협의사항` 메뉴에서 확인하고 답변할 수 있습니다.

관리자 PIN은 현재 프로토타입 기준 `0000`입니다. 실제 장기 운영 시 Supabase Auth 기반 계정으로 전환하는 것을 권장합니다.
