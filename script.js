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

// DOM要素の取得
const stageInfo = document.getElementById('current-stage');
const permissionModal = document.getElementById('permission-modal');
const successModal = document.getElementById('success-modal');
const requestPermissionBtn = document.getElementById('request-permission');
const nextStageBtn = document.getElementById('next-stage-btn');
const tutorialNextBtn = document.getElementById('tutorial-next');

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
    initGame();
});

function initGame() {
    // 許可ボタンのイベントリスナー
    requestPermissionBtn.addEventListener('click', requestSensorPermission);
    
    // 次のステージボタン
    nextStageBtn.addEventListener('click', goToNextStage);
    
    // チュートリアル次へボタン
    tutorialNextBtn.addEventListener('click', function() {
        if (permissionGranted) {
            goToNextStage();
        } else {
            alert('センサーへのアクセス許可が必要です。');
        }
    });
    
    updateStageDisplay();
}

// センサー許可要求
async function requestSensorPermission() {
    try {
        // iOS 13+ 対応
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission === 'granted') {
                permissionGranted = true;
                startSensorListening();
                closePermissionModal();
            } else {
                alert('センサーへのアクセスが拒否されました。ゲームを正常に動作させるには許可が必要です。');
            }
        } else {
            // Android や旧iOS
            permissionGranted = true;
            startSensorListening();
            closePermissionModal();
        }
    } catch (error) {
        console.error('センサー許可エラー:', error);
        // フォールバック: 許可なしで開始
        permissionGranted = true;
        startSensorListening();
        closePermissionModal();
    }
}

function closePermissionModal() {
    permissionModal.classList.remove('active');
}

// センサーリスニング開始
function startSensorListening() {
    // デバイス方向イベント
    window.addEventListener('deviceorientation', handleOrientation);
    
    // デバイスモーションイベント（追加のセンサー情報用）
    window.addEventListener('devicemotion', handleMotion);
}

// デバイス方向ハンドラー
function handleOrientation(event) {
    // コンパス値を取得（webkitCompassHeadingがあればそれを使用、なければalphaを使用）
    let heading = event.webkitCompassHeading || (360 - (event.alpha || 0));
    
    // 0-360の範囲に正規化
    compassHeading = Math.round((heading + 360) % 360);
    
    // 傾きの値を取得
    tiltX = Math.round(event.beta || 0);  // 前後の傾き
    tiltY = Math.round(event.gamma || 0); // 左右の傾き
    
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
    console.log('DeviceOrientationEvent supported:', 'DeviceOrientationEvent' in window);
    console.log('DeviceMotionEvent supported:', 'DeviceMotionEvent' in window);
    console.log('Permission API supported:', typeof DeviceOrientationEvent.requestPermission === 'function');
}

// エラーハンドリング
window.addEventListener('error', function(event) {
    console.error('ゲームエラー:', event.error);
});

// ページ読み込み完了時にセンサーサポートをチェック
window.addEventListener('load', function() {
    checkSensorSupport();
}); 