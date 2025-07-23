// ゲーム状態管理
let currentStage = 0;
let compassHeading = 0;
let tiltX = 0;
let tiltY = 0;
let isHolding = false;
let holdTimer = 0;
let holdStartTime = 0;
let holdInterval = null;
let permissionGranted = false;

// DOM要素の取得（グローバル変数として保持）
let stageInfo, permissionModal, successModal, requestPermissionBtn, nextStageBtn, tutorialNextBtn;

// DOM要素を安全に取得する関数
function initDOMElements() {
    try {
        stageInfo = document.getElementById('current-stage');
        permissionModal = document.getElementById('permission-modal');
        successModal = document.getElementById('success-modal');
        requestPermissionBtn = document.getElementById('request-permission');
        nextStageBtn = document.getElementById('next-stage-btn');
        tutorialNextBtn = document.getElementById('tutorial-next');
        
        console.log('🔧 DOM要素を再取得しました');
        return true;
    } catch (error) {
        console.error('❌ DOM要素取得エラー:', error);
        return false;
    }
}

// センサー値表示要素
const compassValueEl = document.getElementById('compass-value');
const tiltXEl = document.getElementById('tilt-x');
const tiltYEl = document.getElementById('tilt-y');

// ステージ1要素
const compassDisplay = document.getElementById('compass-display');
const compassNeedle = document.getElementById('compass-needle');
const holdProgress = document.getElementById('hold-progress');
const holdTimerEl = document.getElementById('hold-timer');

// ステージ2要素
const currentDirectionEl = document.getElementById('current-direction');
const directionNeedle = document.getElementById('direction-needle');
const directionCompassDisplay = document.getElementById('direction-compass-display');
const accuracyIndicator = document.getElementById('accuracy-indicator');
const accuracyText = document.getElementById('accuracy-text');

// 成功メッセージ要素
const successMessage = document.getElementById('success-message');

// ゲーム初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM読み込み完了');
    // 少し遅延を入れて確実にDOM要素が取得できるようにする
    setTimeout(() => {
        initGame();
    }, 100);
});

function initGame() {
    console.log('🎮 ゲームを初期化中...');
    
    try {
        // DOM要素の初期化
        if (!initDOMElements()) {
            throw new Error('DOM要素の取得に失敗しました');
        }
        
        // DOM要素の再取得（より確実な取得）
        const requestBtn = document.getElementById('request-permission');
        const modal = document.getElementById('permission-modal');
        const nextBtn = document.getElementById('next-stage-btn');
        const tutorialBtn = document.getElementById('tutorial-next');
        
        // 要素の存在確認
        console.log('📋 DOM要素確認:');
        console.log('- request-permission:', !!requestBtn);
        console.log('- permission-modal:', !!modal);
        console.log('- next-stage-btn:', !!nextBtn);
        console.log('- tutorial-next:', !!tutorialBtn);
        
        // 許可ボタンのイベントリスナー
        if (requestBtn) {
            // 既存のイベントリスナーを削除
            requestBtn.removeEventListener('click', requestSensorPermission);
            // 新しいイベントリスナーを追加
            requestBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🔘 許可ボタンクリック！');
                requestSensorPermission();
            });
            console.log('✅ 許可ボタンにイベントリスナーを追加');
        } else {
            console.error('❌ 許可ボタンが見つかりません');
        }
        
        // 次のステージボタン
        if (nextBtn) {
            nextBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🔘 次のステージボタンクリック');
                goToNextStage();
            });
            console.log('✅ 次のステージボタンにイベントリスナーを追加');
        }
        
        // チュートリアル次へボタン
        if (tutorialBtn) {
            tutorialBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🔘 チュートリアル次へボタンクリック');
                if (permissionGranted) {
                    goToNextStage();
                } else {
                    alert('センサーへのアクセス許可が必要です。');
                }
            });
            console.log('✅ チュートリアル次へボタンにイベントリスナーを追加');
        }
        
        // ステージ表示を更新
        updateStageDisplay();
        
        // 環境情報をログ出力
        console.log('🌐 環境情報:');
        console.log('- URL:', window.location.href);
        console.log('- Protocol:', window.location.protocol);
        console.log('- User Agent:', navigator.userAgent.substring(0, 50) + '...');
        
        console.log('✅ ゲーム初期化完了');
        
    } catch (error) {
        console.error('❌ ゲーム初期化エラー:', error);
        alert('ゲームの初期化でエラーが発生しました:\n' + error.message);
    }
}

// センサー許可要求
async function requestSensorPermission() {
    console.log('センサー許可を要求中...');
    console.log('User Agent:', navigator.userAgent);
    
    try {
        // iOS判定
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        
        console.log('デバイス判定:', { isIOS, isAndroid });
        
        // iOS 13+ でのセンサー許可要求
        if (isIOS && typeof DeviceOrientationEvent.requestPermission === 'function') {
            console.log('iOS 13+ センサー許可要求開始');
            
            try {
                // DeviceOrientationEventの許可要求
                const orientationPermission = await DeviceOrientationEvent.requestPermission();
                console.log('DeviceOrientation許可結果:', orientationPermission);
                
                // DeviceMotionEventの許可要求（利用可能な場合）
                let motionPermission = 'granted';
                if (typeof DeviceMotionEvent.requestPermission === 'function') {
                    motionPermission = await DeviceMotionEvent.requestPermission();
                    console.log('DeviceMotion許可結果:', motionPermission);
                }
                
                if (orientationPermission === 'granted') {
                    console.log('✅ iOS センサー許可成功');
                    permissionGranted = true;
                    startSensorListening();
                    closePermissionModal();
                    return;
                } else {
                    console.log('❌ iOS センサー許可拒否');
                    alert('センサーへのアクセスが拒否されました。\n設定でこのサイトのモーションとセンサーへのアクセスを許可してください。');
                    return;
                }
            } catch (error) {
                console.error('iOS許可要求エラー:', error);
                alert('センサー許可の要求中にエラーが発生しました。\nページを再読み込みして再試行してください。');
                return;
            }
        } 
        // Android または旧iOS
        else {
            console.log('Android/旧iOS - 直接センサー開始');
            permissionGranted = true;
            startSensorListening();
            closePermissionModal();
            
            // 動作確認用のテスト
            setTimeout(() => {
                console.log('3秒後のセンサー値チェック:', { compassHeading, tiltX, tiltY });
                if (compassHeading === 0 && tiltX === 0 && tiltY === 0) {
                    console.warn('センサー値が0のまま');
                    // ダミー値を設定してテスト
                    compassHeading = Math.floor(Math.random() * 360);
                    tiltX = Math.floor(Math.random() * 20) - 10;
                    tiltY = Math.floor(Math.random() * 20) - 10;
                    updateSensorDisplay();
                    console.log('ダミー値を設定:', { compassHeading, tiltX, tiltY });
                }
            }, 3000);
        }
        
    } catch (error) {
        console.error('センサー許可処理エラー:', error);
        alert('センサー許可処理でエラーが発生しました:\n' + error.message);
        
        // 緊急フォールバック
        console.log('緊急フォールバック実行');
        permissionGranted = true;
        closePermissionModal();
        
        // テスト用のダミー値を設定
        setInterval(() => {
            compassHeading = (compassHeading + 1) % 360;
            tiltX = Math.sin(Date.now() / 1000) * 10;
            tiltY = Math.cos(Date.now() / 1000) * 10;
            updateSensorDisplay();
            handleStageLogic();
        }, 100);
    }
}

function closePermissionModal() {
    console.log('許可モーダルを閉じます');
    try {
        const modal = document.getElementById('permission-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
            console.log('✅ 許可モーダルが閉じられました');
        } else {
            console.error('❌ 許可モーダル要素が見つかりません');
        }
    } catch (error) {
        console.error('モーダル終了エラー:', error);
    }
}

// センサーリスニング開始
function startSensorListening() {
    console.log('📱 センサーリスニングを開始します');
    
    try {
        // 既存のイベントリスナーを削除（重複を防ぐ）
        window.removeEventListener('deviceorientation', handleOrientation);
        window.removeEventListener('devicemotion', handleMotion);
        console.log('既存のイベントリスナーを削除');
        
        // デバイス方向イベント - パッシブリスナーとして追加
        window.addEventListener('deviceorientation', handleOrientation, { passive: true });
        console.log('✅ deviceorientationイベントリスナーを追加 (passive)');
        
        // デバイスモーションイベント
        window.addEventListener('devicemotion', handleMotion, { passive: true });
        console.log('✅ devicemotionイベントリスナーを追加 (passive)');
        
        // 初期値設定
        setTimeout(() => {
            console.log('📊 1秒後のセンサー値:', { compassHeading, tiltX, tiltY });
            
            // センサーが動作していない場合の検出と対策
            if (compassHeading === 0 && tiltX === 0 && tiltY === 0) {
                console.warn('⚠️ センサー値が0のまま - テストイベントを発火');
                
                // テスト用のイベントを手動発火
                const testEvent = new DeviceOrientationEvent('deviceorientation', {
                    alpha: 45,    // コンパス値
                    beta: 10,     // X軸の傾き
                    gamma: 5,     // Y軸の傾き
                    absolute: true
                });
                
                handleOrientation(testEvent);
                console.log('🧪 テストイベントを発火しました');
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ センサーリスニング開始エラー:', error);
        alert('センサーの初期化でエラーが発生しました。\nページを再読み込みしてください。');
    }
}

// デバイス方向ハンドラー
function handleOrientation(event) {
    // デバッグ用：初回のイベント受信をログ
    if (!window.firstOrientationReceived) {
        console.log('初回デバイス方向イベント受信:', event);
        window.firstOrientationReceived = true;
    }
    
    // コンパス値を取得（webkitCompassHeadingがあればそれを使用、なければalphaを使用）
    let heading = event.webkitCompassHeading;
    
    // iOSとAndroidでの処理の違いを考慮
    if (heading === undefined || heading === null) {
        heading = event.alpha;
        if (heading !== null) {
            // Androidの場合、alphaを使用して計算
            heading = (360 - heading) % 360;
        }
    }
    
    // コンパス値が取得できない場合のフォールバック
    if (heading === null || heading === undefined) {
        console.warn('コンパス値を取得できません');
        heading = 0;
    }
    
    // 0-360の範囲に正規化
    compassHeading = Math.round((heading + 360) % 360);
    
    // 傾きの値を取得
    tiltX = Math.round(event.beta || 0);  // 前後の傾き（X軸回転）
    tiltY = Math.round(event.gamma || 0); // 左右の傾き（Y軸回転）
    
    // センサー値の表示更新
    updateSensorDisplay();
    
    // 現在のステージに応じて処理
    handleStageLogic();
}

// デバイスモーションハンドラー
function handleMotion(event) {
    // 必要に応じて加速度センサーの値も使用可能
    // event.acceleration, event.accelerationIncludingGravity, event.rotationRate
}

// センサー値表示更新
function updateSensorDisplay() {
    if (compassValueEl) compassValueEl.textContent = `${compassHeading}°`;
    if (tiltXEl) tiltXEl.textContent = `${tiltX}°`;
    if (tiltYEl) tiltYEl.textContent = `${tiltY}°`;
}

// ステージ別のロジック処理
function handleStageLogic() {
    switch (currentStage) {
        case 1:
            handleStage1Logic();
            break;
        case 2:
            handleStage2Logic();
            break;
    }
}

// ステージ1: コンパス45度チャレンジ
function handleStage1Logic() {
    // コンパス表示更新
    if (compassDisplay) compassDisplay.textContent = `${compassHeading}°`;
    if (compassNeedle) {
        compassNeedle.style.transform = `translate(-50%, -100%) rotate(${compassHeading}deg)`;
    }
    
    // 45度に近いかチェック（±5度の許容範囲）
    const target = 45;
    const tolerance = 5;
    const isNearTarget = Math.abs(compassHeading - target) <= tolerance || 
                        Math.abs(compassHeading - target - 360) <= tolerance ||
                        Math.abs(compassHeading - target + 360) <= tolerance;
    
    if (isNearTarget && !isHolding) {
        // 保持開始
        isHolding = true;
        holdStartTime = Date.now();
        startHoldTimer();
    } else if (!isNearTarget && isHolding) {
        // 保持中断
        stopHoldTimer();
    }
}

// 保持タイマー開始
function startHoldTimer() {
    holdInterval = setInterval(() => {
        holdTimer = (Date.now() - holdStartTime) / 1000;
        
        // プログレスバー更新
        const progress = Math.min((holdTimer / 3) * 100, 100);
        if (holdProgress) holdProgress.style.width = `${progress}%`;
        if (holdTimerEl) holdTimerEl.textContent = `${holdTimer.toFixed(1)}秒維持中`;
        
        // 3秒達成でクリア
        if (holdTimer >= 3) {
            stopHoldTimer();
            stageComplete('ステージ1クリア！\n45°を3秒間維持できました！');
        }
    }, 100);
}

// 保持タイマー停止
function stopHoldTimer() {
    if (holdInterval) {
        clearInterval(holdInterval);
        holdInterval = null;
    }
    isHolding = false;
    holdTimer = 0;
    
    // UI リセット
    if (holdProgress) holdProgress.style.width = '0%';
    if (holdTimerEl) holdTimerEl.textContent = '0.0秒維持中';
}

// ステージ2: 東北を向く
function handleStage2Logic() {
    // 方向表示更新
    if (directionCompassDisplay) {
        directionCompassDisplay.textContent = `${compassHeading}°`;
    }
    if (directionNeedle) {
        directionNeedle.style.transform = `translate(-50%, -100%) rotate(${compassHeading}deg)`;
    }
    
    // 現在の方角を計算
    const direction = getDirectionFromHeading(compassHeading);
    if (currentDirectionEl) currentDirectionEl.textContent = direction;
    
    // 東北（45度）に近いかチェック
    const target = 45; // 東北は45度
    const tolerance = 10; // 許容範囲を少し広く
    const difference = Math.min(
        Math.abs(compassHeading - target),
        Math.abs(compassHeading - target + 360),
        Math.abs(compassHeading - target - 360)
    );
    
    // 精度表示更新
    if (difference <= tolerance) {
        accuracyIndicator.classList.add('success');
        if (difference <= 5) {
            accuracyText.textContent = '完璧！東北を向いています！';
            // 2秒後にクリア
            setTimeout(() => {
                stageComplete('ステージ2クリア！\n東北の方角を見つけました！');
            }, 2000);
        } else {
            accuracyText.textContent = '良い感じです！もう少し調整してください。';
        }
    } else {
        accuracyIndicator.classList.remove('success');
        if (difference <= 20) {
            accuracyText.textContent = '近づいています！';
        } else {
            accuracyText.textContent = '方角を調整してください';
        }
    }
}

// 角度から方角を取得
function getDirectionFromHeading(heading) {
    const directions = [
        { name: '北', min: 0, max: 22.5 },
        { name: '北北東', min: 22.5, max: 67.5 },
        { name: '東北', min: 337.5, max: 360 }, // 北の続き
        { name: '東北', min: 22.5, max: 67.5 },
        { name: '東', min: 67.5, max: 112.5 },
        { name: '南東', min: 112.5, max: 157.5 },
        { name: '南', min: 157.5, max: 202.5 },
        { name: '南西', min: 202.5, max: 247.5 },
        { name: '西', min: 247.5, max: 292.5 },
        { name: '北西', min: 292.5, max: 337.5 }
    ];
    
    // 簡易版の方角判定
    if (heading >= 337.5 || heading < 22.5) return '北';
    if (heading >= 22.5 && heading < 67.5) return '東北';
    if (heading >= 67.5 && heading < 112.5) return '東';
    if (heading >= 112.5 && heading < 157.5) return '南東';
    if (heading >= 157.5 && heading < 202.5) return '南';
    if (heading >= 202.5 && heading < 247.5) return '南西';
    if (heading >= 247.5 && heading < 292.5) return '西';
    if (heading >= 292.5 && heading < 337.5) return '北西';
    
    return '不明';
}

// ステージクリア
function stageComplete(message) {
    successMessage.textContent = message;
    successModal.classList.add('active');
}

// 次のステージへ進む
function goToNextStage() {
    successModal.classList.remove('active');
    
    // 現在のステージを非表示
    const currentStageEl = document.getElementById(`stage-${currentStage}`);
    if (currentStageEl) {
        currentStageEl.classList.remove('active');
    }
    
    // 次のステージへ
    currentStage++;
    
    // ステージ2まで実装済み
    if (currentStage > 2) {
        alert('すべてのステージをクリアしました！\nお疲れ様でした！');
        currentStage = 0; // リセット
    }
    
    // 新しいステージを表示
    const nextStageEl = document.getElementById(`stage-${currentStage}`);
    if (nextStageEl) {
        nextStageEl.classList.add('active');
    }
    
    // ステージ情報更新
    updateStageDisplay();
    
    // ステージ状態リセット
    resetStageState();
}

// ステージ表示更新
function updateStageDisplay() {
    if (stageInfo) {
        stageInfo.textContent = `ステージ ${currentStage}`;
    }
}

// ステージ状態リセット
function resetStageState() {
    // ステージ1の状態リセット
    stopHoldTimer();
    
    // ステージ2の状態リセット
    if (accuracyIndicator) {
        accuracyIndicator.classList.remove('success');
    }
    if (accuracyText) {
        accuracyText.textContent = '方角を調整してください';
    }
}

// デバッグ用: センサーサポート確認
function checkSensorSupport() {
    console.log('=== センサーサポート状況 ===');
    console.log('DeviceOrientationEvent supported:', 'DeviceOrientationEvent' in window);
    console.log('DeviceMotionEvent supported:', 'DeviceMotionEvent' in window);
    console.log('Permission API supported:', typeof DeviceOrientationEvent.requestPermission === 'function');
    console.log('User Agent:', navigator.userAgent);
    console.log('Protocol:', location.protocol);
    console.log('Hostname:', location.hostname);
    console.log('Is HTTPS or localhost:', location.protocol === 'https:' || location.hostname === 'localhost');
    
    // ブラウザ判定
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    console.log('iOS:', isIOS);
    console.log('Android:', isAndroid);
    console.log('Safari:', isSafari);
    console.log('==================');
}

// エラーハンドリング
window.addEventListener('error', function(event) {
    console.error('ゲームエラー:', event.error);
});

// ページ読み込み完了時にセンサーサポートをチェック
window.addEventListener('load', function() {
    console.log('🌟 ページ読み込み完了');
    checkSensorSupport();
    
    // デバッグ情報を画面に表示（開発用）
    const debugInfo = document.createElement('div');
    debugInfo.id = 'debug-info';
    debugInfo.style.cssText = `
        position: fixed; 
        top: 0; 
        right: 0; 
        background: rgba(0,0,0,0.8); 
        color: white; 
        padding: 10px; 
        font-size: 12px; 
        z-index: 9999;
        max-width: 300px;
        word-wrap: break-word;
    `;
    debugInfo.innerHTML = `
        <div>🔧 Debug Info</div>
        <div>Agent: ${navigator.userAgent.substring(0, 30)}...</div>
        <div>Protocol: ${location.protocol}</div>
        <div>DeviceOrientation: ${'DeviceOrientationEvent' in window}</div>
    `;
    document.body.appendChild(debugInfo);
    
    // 5秒後にデバッグ情報を隠す
    setTimeout(() => {
        if (debugInfo) debugInfo.style.display = 'none';
    }, 10000);
}); 