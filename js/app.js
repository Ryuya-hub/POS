// グローバル変数
let products = [];
let cart = [];
let cameraStream = null;
let barcodeDetector = null;
let isQuaggaRunning = false;

// 初期化
async function init() {
    await loadProducts();
    updateCart();
}

// 商品データの読み込み
async function loadProducts() {
    try {
        const response = await fetch('./data/products.json');
        if (!response.ok) {
            throw new Error(`HTTPエラー: ${response.status}`);
        }
        products = await response.json();
        console.log('商品データ読み込み完了:', products.length, '件');
        console.log('登録商品:', products);
    } catch (error) {
        console.error('商品データの読み込みエラー:', error);
        alert('商品データの読み込みに失敗しました: ' + error.message);
    }
}

// カートに追加
function addToCart(productCode) {
    console.log('カートに追加しようとしています。商品コード:', productCode);
    console.log('現在の商品データ:', products);

    const product = products.find(p => p.code === productCode);
    if (!product) {
        console.error('商品が見つかりません:', productCode);
        return;
    }

    const existingItem = cart.find(item => item.code === productCode);
    if (existingItem) {
        existingItem.quantity++;
        console.log('既存商品の数量を増加:', existingItem);
    } else {
        cart.push({
            ...product,
            quantity: 1
        });
        console.log('新しい商品をカートに追加:', product);
    }

    console.log('更新後のカート:', cart);
    updateCart();
}

// カート更新
function updateCart() {
    const cartArea = document.getElementById('cartArea');

    if (cart.length === 0) {
        cartArea.innerHTML = '<div class="cart-empty">商品が選択されていません</div>';
        return;
    }

    // 小計計算
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // 税額計算（10%、端数切り捨て）
    const taxAmount = Math.floor(subtotal * 0.1);

    // 合計
    const total = subtotal + taxAmount;

    let html = '<div class="cart-items">';

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        html += `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-code">${item.code}</div>
                </div>
                <div class="cart-item-controls">
                    <div class="quantity-control">
                        <button class="quantity-button" onclick="decreaseQuantity('${item.code}')">-</button>
                        <span class="quantity-display">${item.quantity}</span>
                        <button class="quantity-button" onclick="increaseQuantity('${item.code}')">+</button>
                    </div>
                    <div class="cart-item-price">¥${itemTotal.toLocaleString()}</div>
                    <button class="delete-button" onclick="removeFromCart('${item.code}')">🗑</button>
                </div>
            </div>
        `;
    });

    html += '</div>';

    html += `
        <div class="cart-summary">
            <div class="summary-row">
                <span>小計</span>
                <span>¥${subtotal.toLocaleString()}</span>
            </div>
            <div class="summary-row">
                <span>標準税率 10%</span>
                <span>¥${taxAmount.toLocaleString()}</span>
            </div>
            <div class="summary-row">
                <span>消費税合計</span>
                <span>¥${taxAmount.toLocaleString()}</span>
            </div>
            <div class="summary-row total">
                <span>合計</span>
                <span>¥${total.toLocaleString()}</span>
            </div>
        </div>
        <button class="checkout-button" onclick="checkout()">
            🧾 会計する
        </button>
    `;

    cartArea.innerHTML = html;
}

// 数量増加
function increaseQuantity(productCode) {
    const item = cart.find(item => item.code === productCode);
    if (item && item.quantity < 99) {
        item.quantity++;
        updateCart();
    }
}

// 数量減少
function decreaseQuantity(productCode) {
    const item = cart.find(item => item.code === productCode);
    if (item && item.quantity > 1) {
        item.quantity--;
        updateCart();
    }
}

// カートから削除
function removeFromCart(productCode) {
    cart = cart.filter(item => item.code !== productCode);
    updateCart();
}

// バーコードモーダル開く
async function openBarcodeModal() {
    document.getElementById('barcodeModal').classList.add('active');
    await startCamera();
}

// バーコードモーダル閉じる
function closeBarcodeModal() {
    document.getElementById('barcodeModal').classList.remove('active');
    stopCamera();
}

// カメラ起動
async function startCamera() {
    const video = document.getElementById('cameraVideo');
    const status = document.getElementById('scannerStatus');

    try {
        // Barcode Detection APIの利用可能性チェック
        if ('BarcodeDetector' in window) {
            const supportedFormats = await BarcodeDetector.getSupportedFormats();
            console.log('サポートされているバーコードフォーマット:', supportedFormats);
            barcodeDetector = new BarcodeDetector({
                formats: ['code_128', 'ean_13', 'ean_8', 'qr_code']
            });
            console.log('Barcode Detection API を使用します');

            const constraints = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = cameraStream;

            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    video.play();
                    resolve();
                };
            });

            status.textContent = 'バーコードを枠内に合わせてください';
            status.style.backgroundColor = 'rgba(16, 185, 129, 0.8)';
            scanBarcode(video, status);
        } else {
            // QuaggaJSを使用
            console.log('QuaggaJSを使用してバーコードスキャンを開始します');
            status.textContent = 'バーコードを枠内に合わせてください';
            status.style.backgroundColor = 'rgba(16, 185, 129, 0.8)';
            startQuaggaScanner();
        }
    } catch (error) {
        console.error('カメラエラー:', error);
        status.textContent = 'カメラの起動に失敗しました: ' + error.message;
        status.style.backgroundColor = 'rgba(239, 68, 68, 0.8)';
    }
}

// QuaggaJSスキャナー起動
function startQuaggaScanner() {
    const scannerArea = document.getElementById('scannerArea');
    isQuaggaRunning = true;

    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: scannerArea,
            constraints: {
                facingMode: "environment",
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            area: {
                top: "20%",
                right: "10%",
                left: "10%",
                bottom: "20%"
            }
        },
        decoder: {
            readers: [
                "ean_reader"  // EAN-13専用
            ],
            multiple: false
        },
        locate: true,
        locator: {
            patchSize: "large",
            halfSample: false
        },
        numOfWorkers: navigator.hardwareConcurrency || 4,
        frequency: 5
    }, function(err) {
        if (err) {
            console.error('Quagga初期化エラー:', err);
            const status = document.getElementById('scannerStatus');
            status.textContent = 'カメラの起動に失敗しました: ' + err.message;
            status.style.backgroundColor = 'rgba(239, 68, 68, 0.8)';
            isQuaggaRunning = false;
            return;
        }
        console.log('Quagga初期化成功');
        Quagga.start();
    });

    // バーコード検出イベント（重複検出を防ぐ）
    let lastDetectedCode = null;
    let lastDetectedTime = 0;

    Quagga.onDetected(function(result) {
        const code = result.codeResult.code;
        const currentTime = Date.now();

        // 同じバーコードを連続で検出しないように500ms以内は無視
        if (code === lastDetectedCode && currentTime - lastDetectedTime < 500) {
            return;
        }

        lastDetectedCode = code;
        lastDetectedTime = currentTime;

        console.log('Quaggaでバーコード検出:', code, 'フォーマット:', result.codeResult.format);
        console.log('検出バーコード長:', code.length);

        // 商品コードを検索（完全一致、前ゼロ付き、前ゼロなしで試す）
        let product = products.find(p => p.code === code);

        // 完全一致しない場合、前のゼロを除去して検索
        if (!product && code.startsWith('0')) {
            const codeWithoutLeadingZero = code.substring(1);
            product = products.find(p => p.code === codeWithoutLeadingZero);
            console.log('前ゼロを除去して検索:', codeWithoutLeadingZero);
        }

        // それでも見つからない場合、前にゼロを追加して検索
        if (!product) {
            const codeWithLeadingZero = '0' + code;
            product = products.find(p => p.code === codeWithLeadingZero);
            console.log('前ゼロを追加して検索:', codeWithLeadingZero);
        }

        const status = document.getElementById('scannerStatus');

        if (product) {
            console.log('商品発見:', product);
            status.textContent = `検出: ${product.name}`;
            status.style.backgroundColor = 'rgba(16, 185, 129, 0.8)';

            // カートに追加
            addToCart(product.code);

            // 少し待ってからモーダルを閉じる
            setTimeout(() => {
                closeBarcodeModal();
            }, 500);
        } else {
            console.log('商品が見つかりません。検出コード:', code);
            console.log('登録商品コード一覧:', products.map(p => p.code));
            status.textContent = `未登録の商品: ${code}`;
            status.style.backgroundColor = 'rgba(251, 191, 36, 0.8)';

            setTimeout(() => {
                if (isQuaggaRunning) {
                    status.textContent = 'バーコードを枠内に合わせてください';
                    status.style.backgroundColor = 'rgba(16, 185, 129, 0.8)';
                }
            }, 2000);
        }
    });
}

// カメラ停止
function stopCamera() {
    if (isQuaggaRunning) {
        console.log('Quaggaを停止します');
        Quagga.stop();
        Quagga.offDetected();
        isQuaggaRunning = false;
    }

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

// バーコードスキャン
async function scanBarcode(video, status) {
    if (!barcodeDetector || !cameraStream) {
        console.log('スキャン停止: barcodeDetector=', !!barcodeDetector, ', cameraStream=', !!cameraStream);
        return;
    }

    try {
        const barcodes = await barcodeDetector.detect(video);

        if (barcodes.length > 0) {
            const barcode = barcodes[0];
            const code = barcode.rawValue;
            console.log('バーコード検出:', code, 'フォーマット:', barcode.format);

            // 商品コードを検索
            const product = products.find(p => p.code === code);

            if (product) {
                console.log('商品発見:', product);
                status.textContent = `検出: ${product.name}`;
                status.style.backgroundColor = 'rgba(16, 185, 129, 0.8)';

                // カートに追加
                addToCart(code);

                // 少し待ってからモーダルを閉じる
                setTimeout(() => {
                    closeBarcodeModal();
                }, 500);
                return;
            } else {
                console.log('商品が見つかりません。検出コード:', code);
                console.log('登録商品コード一覧:', products.map(p => p.code));
                status.textContent = `未登録の商品: ${code}`;
                status.style.backgroundColor = 'rgba(251, 191, 36, 0.8)';

                // 2秒後にステータスをリセット
                setTimeout(() => {
                    status.textContent = 'バーコードを枠内に合わせてください';
                    status.style.backgroundColor = 'rgba(16, 185, 129, 0.8)';
                }, 2000);
            }
        }
    } catch (error) {
        console.error('バーコード検出エラー:', error);
    }

    // 次のフレームで再スキャン
    if (cameraStream) {
        requestAnimationFrame(() => scanBarcode(video, status));
    }
}

// 会計処理
function checkout() {
    if (cart.length === 0) return;

    // 取引ID生成
    const transactionId = 'TXN' + Date.now();
    const now = new Date();
    const dateTime = now.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    // 小計・税額・合計計算
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxAmount = Math.floor(subtotal * 0.1);
    const total = subtotal + taxAmount;

    // レシート生成
    let receiptHTML = `
        <div class="receipt-header">
            <h2>ポップアップストア</h2>
            <p>請求書</p>
        </div>
        <div class="receipt-info">
            <div>取引ID: ${transactionId}</div>
            <div>日時: ${dateTime}</div>
        </div>
        <div class="receipt-items">
    `;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        receiptHTML += `
            <div class="receipt-item">
                <div>
                    <div>${item.name}</div>
                    <div style="font-size: 12px; color: #6b7280;">¥${item.price.toLocaleString()} × ${item.quantity}</div>
                </div>
                <div>¥${itemTotal.toLocaleString()}</div>
            </div>
        `;
    });

    receiptHTML += `
        </div>
        <div class="receipt-summary">
            <div class="summary-row">
                <span>小計</span>
                <span>¥${subtotal.toLocaleString()}</span>
            </div>
            <div class="summary-row">
                <span>標準税率 10%</span>
                <span>¥${taxAmount.toLocaleString()}</span>
            </div>
            <div class="summary-row total">
                <span>合計</span>
                <span>¥${total.toLocaleString()}</span>
            </div>
        </div>
        <div class="receipt-footer">
            ご利用ありがとうございました
        </div>
    `;

    document.getElementById('receiptContent').innerHTML = receiptHTML;
    document.getElementById('receiptModal').classList.add('active');

    // カートをクリア
    cart = [];
    updateCart();
}

// レシートモーダル閉じる
function closeReceiptModal() {
    document.getElementById('receiptModal').classList.remove('active');
}

// モーダル外クリックで閉じる
document.addEventListener('DOMContentLoaded', function() {
    // 初期化
    init();

    // モーダル外クリックイベント
    document.getElementById('barcodeModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeBarcodeModal();
        }
    });

    document.getElementById('receiptModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeReceiptModal();
        }
    });
});
