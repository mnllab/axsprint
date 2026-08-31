# AX Sprint Control Tower MVP v18

이번 버전은 v17 디자인을 유지하면서 Supabase 공유DB와 일정/세부항목 편집 기능을 추가했습니다.

## 1. Supabase 최초 설정

1. Supabase Dashboard에서 현재 프로젝트를 엽니다.
2. 왼쪽 메뉴 `SQL Editor` → `New query`를 엽니다.
3. 이 폴더의 `supabase_setup.sql` 전체 내용을 붙여넣고 `Run`을 누릅니다.
4. 완료 후 `index.html`을 열고 상단 상태가 `공유DB 연결됨` 또는 `초기 데이터 필요`로 표시되는지 확인합니다.
5. `관리자` 버튼 → 비밀번호 `0000`으로 접속합니다.
6. DB가 비어 있으면 관리자 접속 시 현재 초기 데이터가 Supabase에 자동 등록됩니다.

주의: `supabase_setup.sql`에는 관리자 PIN이 들어 있으므로 공개 GitHub 저장소에는 올리지 마십시오. 한 번 실행한 뒤 로컬 보관만 권장합니다.

## 2. GitHub Pages에 올릴 파일

다음 파일만 배포하면 됩니다.

- index.html
- junctionmed.html
- kyungbok.html
- carefuture.html
- aimlab.html
- styles.css
- app.js
- data.js
- supabase-config.js

`supabase-config.js`의 Project URL과 Publishable key는 브라우저용 공개 키입니다. Secret key는 사용하지 않습니다.

## 3. 기관별 링크

- 정션메드: `junctionmed.html`
- 경복대학교: `kyungbok.html`
- 돌봄과 미래: `carefuture.html`
- 에임랩: `aimlab.html`

모든 화면은 같은 Supabase `ax_project_state` 데이터를 사용합니다.

## 4. 일정 운영 방식

각 진행항목은 두 일정을 가집니다.

- 기준일정: 사업계획서/기존 마일스톤 기준, 최초값 보존
- 현재일정: 실제 수행상황에 맞춰 자유롭게 수정

관리자 `실행과제` 메뉴에서 항목을 클릭하면 다음을 바꿀 수 있습니다.

- 항목명
- 책임기관/협업기관
- 상위항목
- 현재 시작일/종료일
- 일정 변경 사유
- 상태
- 진행단계 표시
- 완료기준
- 필요 증빙
- 현재 이슈
- PM 확인 필요 여부
- 활성/비활성

기존 항목에서 `+ 세부항목`을 누르면 해당 항목 아래에 세부항목을 추가할 수 있습니다. `복제`도 지원합니다.

## 5. 데이터 저장

- 관리자 수정: PIN 확인 후 Supabase에 공용 상태 저장
- 기관 회신: 해당 요청의 회신 필드만 Supabase에서 갱신
- 기관 협의사항: 해당 기관 메모에 새 메시지만 추가
- 브라우저 LocalStorage: 네트워크 오류에 대비한 로컬 캐시로 유지
- 기관 화면: 약 30초 간격 및 창 재활성화 시 공용 데이터를 다시 불러옴

## 6. 현재 보안 수준

관리자 PIN `0000`은 서버측 Supabase 함수에서 확인합니다. 브라우저 코드에는 PIN을 저장하지 않습니다. 다만 4자리 PIN 자체가 약하므로 정식 운영 안정화 후에는 Supabase Auth 기반 관리자 계정으로 전환하는 것을 권장합니다.
