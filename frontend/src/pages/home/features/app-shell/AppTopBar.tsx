// Khu vực điều hướng hàng đầu——Yêu cầu xóa nền thẻ trắng của người dùng:logo Bên trái nhất、"Thư viện/Bộ sưu tập/Yêu thích/AI"Cột trung tâm,
// Trôi nổi trực tiếp trên trang dưới cùng màu xám。tăng thêm/Tìm kiếm/Thiết lập Cả ba chìm vào thanh nổi đầu tiên.
// (AppBottomBar.jsx)。
//
// Phương pháp tiếp cận trung tâm:logo bên trái、Mỗi bên một cái flex:1 của spacer cầm tabs Bóp vào giữa。#developer-btn/
// #open-output-btn Là hợp đồng id(Tham chiếu bài kiểm tra),Giữ trong display:none trong một thùng chứa ẩn,Không chiếm bố cục。

import { LibraryTopTabs } from "../library/page/LibraryTopTabs.jsx";

export function AppTopBar({ activeTab, onTabChange }) {
  return (
    <app-shell-header class="app-shell-header">
      <header className="topbar library-topbar">
        <a
          className="hero-repo-link library-brand-link"
          href="https://github.com/wxyhgk/retain-pdf"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img className="hero-repo-logo" src="src/assets/RetainPDF-logo.svg" alt="RetainPDF logo" />
          <span>RetainPDF</span>
        </a>
        <div className="hero-actions hidden" aria-hidden="true">
          <button id="developer-btn" type="button" className="secondary hidden" aria-hidden="true">Nhà phát triển</button>
          <button id="open-output-btn" type="button" className="secondary hidden">Mở thư mục đầu ra</button>
        </div>
        <div className="library-topbar-spacer" aria-hidden="true" />
        <LibraryTopTabs active={activeTab} onChange={onTabChange} />
        <div className="library-topbar-spacer" aria-hidden="true" />
      </header>
    </app-shell-header>
  );
}
