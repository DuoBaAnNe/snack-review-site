export default function Footer() {
    return (
        <footer className="mt-12 border-t border-gray-200 bg-white py-6 text-center text-xs text-gray-400">
            <p className="text-sm font-medium text-gray-500">七零十 · 属于所有人的零食测评网站</p>
            <p className="mt-2">抖音：西瓜Naive</p>
            <p className="mt-1">© {new Date().getFullYear()} linglingqi.fun 七零十</p>
            <p className="mt-1">
                <a
                    href="https://beian.miit.gov.cn/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-gray-600"
                >
                    粤ICP备2026121558号-1
                </a>
            </p>
        </footer>
    );
}
