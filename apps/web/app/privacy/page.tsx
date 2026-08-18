import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Policy — Orb' }

/**
 * 개인정보처리방침 — 가입 시 필수 동의 문서. [대괄호] 항목은 사업자등록 후 채울 것.
 * 개정 시 VERSION을 올리고 하단 개정 이력에 남긴다.
 */
const PRIVACY_VERSION = '1.0 (2026-08-18)'

export default function PrivacyPage() {
  return (
    <main className="legal">
      <header className="legal-head">
        <div className="legal-brand">orb</div>
        <h1>개인정보처리방침</h1>
        <div className="legal-meta">버전 {PRIVACY_VERSION} · 시행일 2026-08-18</div>
      </header>

      <section>
        <h2>1. 수집하는 개인정보</h2>
        <div className="legal-tablewrap">
          <table>
            <thead><tr><th>항목</th><th>목적</th><th>보유기간</th></tr></thead>
            <tbody>
              <tr><td>이메일, 비밀번호(암호화), 아이디, 표시 이름</td><td>회원 식별·로그인</td><td>탈퇴 시 지체 없이 파기</td></tr>
              <tr><td>프로필 사진, 소개글</td><td>프로필 표시</td><td>탈퇴 또는 삭제 시 파기</td></tr>
              <tr><td>채팅 메시지, 업로드 파일(오디오·이미지), 일정</td><td>서비스 핵심 기능 제공</td><td>탈퇴 또는 삭제 시 파기 (채팅 첨부파일은 업로드 7일 후 자동 삭제)</td></tr>
              <tr><td>서비스 이용기록, 접속 로그</td><td>안정적 운영·오류 대응</td><td>통신비밀보호법에 따라 3개월</td></tr>
            </tbody>
          </table>
        </div>
        <p>만 14세 미만 아동의 개인정보는 수집하지 않으며, 가입 시 만 14세 이상임을 확인합니다.</p>
      </section>

      <section>
        <h2>2. 처리위탁 및 국외이전</h2>
        <p>서비스 운영을 위해 아래와 같이 개인정보 처리를 위탁하며, 수탁자의 서버가 국외에 있어 개인정보보호법 제28조의8 제1항 제3호(계약 이행을 위한 처리위탁·보관)에 따라 이전됩니다. 이전은 서비스 이용 시 수시로, 암호화된 통신(TLS)으로 이루어집니다.</p>
        <div className="legal-tablewrap">
          <table>
            <thead><tr><th>수탁자</th><th>국가</th><th>이전 항목</th><th>목적</th><th>보유기간</th></tr></thead>
            <tbody>
              <tr><td>Supabase, Inc. (AWS)</td><td>미국 등</td><td>계정정보, 프로필, 채팅, 일정</td><td>데이터베이스·인증 호스팅</td><td>탈퇴 시까지</td></tr>
              <tr><td>Cloudflare, Inc.</td><td>미국 등</td><td>업로드 파일(오디오·이미지)</td><td>파일 저장</td><td>탈퇴 또는 삭제 시까지 (채팅 첨부는 7일)</td></tr>
              <tr><td>Vercel, Inc.</td><td>미국 등</td><td>접속 로그</td><td>웹·API 호스팅</td><td>수탁사 정책에 따름</td></tr>
              <tr><td>Anthropic, PBC</td><td>미국</td><td>일정 인식 요청 텍스트</td><td>AI 일정 인식</td><td>처리 즉시 파기 요청</td></tr>
            </tbody>
          </table>
        </div>
        <p>정보주체는 국외이전을 원하지 않는 경우 서비스 이용(가입)을 중단할 수 있으며, 이전 관련 문의는 아래 연락처로 할 수 있습니다.</p>
      </section>

      <section>
        <h2>3. AI 기능 안내</h2>
        <p>일정 인식 기능은 생성형 인공지능(Anthropic Claude)을 사용합니다. 입력한 텍스트는 일정 인식 목적으로만 전송·처리되며, AI 모델 학습에 사용되지 않도록 계약된 API를 통해 처리됩니다.</p>
      </section>

      <section>
        <h2>4. 파기</h2>
        <p>보유기간이 끝나거나 처리 목적이 달성되면 지체 없이 파기합니다. 전자적 파일은 복구할 수 없는 방법으로 삭제합니다. 탈퇴 시 계정과 콘텐츠는 즉시 삭제되며, 저장소의 첨부파일은 순차적으로 삭제될 수 있습니다.</p>
      </section>

      <section>
        <h2>5. 정보주체의 권리</h2>
        <p>회원은 언제든지 자신의 개인정보에 대해 열람·정정·삭제·처리정지를 요구할 수 있습니다. 프로필과 콘텐츠는 앱 내에서 직접 수정·삭제할 수 있고, 계정 삭제는 설정 → 계정 삭제에서 할 수 있으며, 그 밖의 요구는 아래 연락처로 하면 지체 없이 조치합니다.</p>
      </section>

      <section>
        <h2>6. 안전성 확보조치</h2>
        <ul>
          <li>비밀번호 일방향 암호화 저장, 전 구간 TLS 암호화 전송</li>
          <li>데이터베이스 접근권한 최소화(행 수준 보안 적용), 접속기록 보관</li>
          <li>개인정보 유출 사고 인지 시 72시간 이내 보호위원회 신고 및 이용자 통지</li>
        </ul>
      </section>

      <section>
        <h2>7. 광고성 정보</h2>
        <p>마케팅 알림은 별도로 동의한 회원에게만, 밤 9시부터 아침 8시 사이를 피해 발송합니다. 동의는 설정에서 언제든 철회할 수 있습니다. 채팅 수신 등 서비스 운영상 필요한 알림은 광고성 정보에 해당하지 않습니다.</p>
      </section>

      <section>
        <h2>8. 개인정보 보호책임자</h2>
        <p className="legal-contact">개인정보 보호책임자: [대표자명] (대표) · wtsteven123@gmail.com</p>
        <p>개인정보 침해에 대한 신고·상담은 개인정보침해신고센터(privacy.kisa.or.kr, 국번 없이 118)에서도 할 수 있습니다.</p>
      </section>

      <footer className="legal-foot">
        <p>[상호/사업자명] · 대표 [대표자명] · 사업자등록번호 [000-00-00000]</p>
        <p>이 방침은 2026-08-18부터 적용됩니다. 변경 시 최소 7일 전 공지합니다.</p>
        <p><a href="/terms">이용약관 →</a></p>
      </footer>
    </main>
  )
}
