import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, query, where, getDocs, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-analytics.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDi6LgXSN2ZKC1mmKSbJlUXFq56vAtt7-4",
  authDomain: "friends-workout-app.firebaseapp.com",
  projectId: "friends-workout-app",
  storageBucket: "friends-workout-app.firebasestorage.app",
  messagingSenderId: "1081676023365",
  appId: "1:1081676023365:web:3e2ee30d755ad8bc7bc52c",
  measurementId: "G-TCJYC6Z595"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

setPersistence(auth, browserLocalPersistence);

const authSection = document.getElementById('auth-section');
const mainApp = document.getElementById('main-app');
const emailInput = document.getElementById('email-input');
const nicknameInput = document.getElementById('nickname-input');
const passwordInput = document.getElementById('password-input');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const userNameElement = document.getElementById('user-name');
const completeButton = document.getElementById('complete-button');
const recommendedWorkoutDiv = document.getElementById('recommended-workout');
const streakCountElement = document.getElementById('streak-count');
const calendarContainer = document.getElementById('calendar-container');


// 로그인 및 자동 회원가입 이벤트
loginButton.addEventListener('click', () => {
    const email = emailInput.value;
    const nickname = nicknameInput.value;
    const password = passwordInput.value;
    
    if (!nickname) {
        alert("닉네임을 입력해주세요!");
        return;
    }

    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            console.log("회원가입 성공! 사용자 ID:", userCredential.user.uid);
            return setDoc(doc(db, "users", userCredential.user.uid), {
                email: email,
                name: nickname,
            });
        })
        .catch((error) => {
            if (error.code === 'auth/email-already-in-use') {
                signInWithEmailAndPassword(auth, email, password)
                    .then((userCredential) => {
                        console.log("로그인 성공!");
                    })
                    .catch((loginError) => {
                        alert(`로그인 실패: ${loginError.message}`);
                    });
            } else {
                alert(`회원가입/로그인 실패: ${error.message}`);
            }
        });
});

// 로그아웃 이벤트
logoutButton.addEventListener('click', () => {
    signOut(auth);
});

// 유튜브 영상 ID 추출 함수
function getYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// 운동 영상 HTML 생성 함수
function createVideoDetailHTML(video) {
    const videoId = getYouTubeId(video.url);
    if (!videoId) return `<p>잘못된 유튜브 주소입니다.</p>`;
    
    return `
        <h5><strong>${video.category || ''}${video.length ? ' /' : ''}</strong>${video.length ? ' ' + video.length + '분' : ''} / ${video.title}</h5>
        <iframe class="video-embed" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>
        <br>
    `;
}

// 오늘의 추천 운동을 보여주는 함수
async function displayDailyWorkout() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const dailyWorkoutDocRef = doc(db, "daily_workouts", today);
        const dailyWorkoutDocSnap = await getDoc(dailyWorkoutDocRef);

        let workoutDocSnap;
        if (dailyWorkoutDocSnap.exists()) {
            const recommendedUrl = dailyWorkoutDocSnap.data().url;
            const workoutQuery = query(collection(db, "운동영상"), where("url", "==", recommendedUrl));
            const workoutQuerySnap = await getDocs(workoutQuery);

            workoutDocSnap = workoutQuerySnap.docs[0];

        } else {
            // 오늘 날짜에 추천 영상이 없으면 랜덤으로 하나 선택
            const allWorkoutsRef = collection(db, "운동영상");
            const allWorkoutsSnap = await getDocs(allWorkoutsRef);
            
            if (!allWorkoutsSnap.empty) {
                const workouts = allWorkoutsSnap.docs;
                const randomIndex = Math.floor(Math.random() * workouts.length);
                workoutDocSnap = workouts[randomIndex];
                
                // 랜덤으로 선택된 영상을 오늘 날짜의 추천 영상으로 저장
                await setDoc(dailyWorkoutDocRef, {
                    url: workoutDocSnap.data().url
                });
            }
        }
        
        if (workoutDocSnap) {
            const recommendedWorkout = workoutDocSnap.data();
            recommendedWorkoutDiv.innerHTML = createVideoDetailHTML(recommendedWorkout);
            completeButton.style.display = 'block';
        } else {
            recommendedWorkoutDiv.innerHTML = `<p>추천 운동을 불러올 수 없습니다. 데이터가 비어있습니다.</p>`;
            completeButton.style.display = 'none';
        }

    } catch (error) {
        console.error("추천 운동 로딩 중 오류 발생:", error);
        recommendedWorkoutDiv.innerHTML = `<p>추천 운동을 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.</p>`;
        completeButton.style.display = 'none';
    }
}


// 오늘의 운동 완료 상태를 확인하고 버튼을 업데이트하는 함수
async function checkDailyCompletion() {
    const user = auth.currentUser;
    if (user) {
        const today = new Date().toISOString().split('T')[0];
        const workoutDocRef = doc(db, "users", user.uid, "workouts_completed", today);
        const docSnap = await getDoc(workoutDocRef);
        
        if (docSnap.exists()) {
            completeButton.textContent = '오늘의 운동 완료!';
        } else {
            completeButton.textContent = '✔️ 완료하기';
        }
        
        loadWorkoutHistory(user.uid);
    }
}


// '완료하기' 버튼 이벤트 리스너
completeButton.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (user) {
        const today = new Date().toISOString().split('T')[0];
        const workoutDocRef = doc(db, "users", user.uid, "workouts_completed", today);
        
        if (completeButton.textContent === '✔️ 완료하기') {
            try {
                await setDoc(workoutDocRef, {
                    timestamp: new Date().toISOString(),
                    completed: true
                });
                alert("운동을 완료했습니다! 기록이 저장되었습니다.");
            } catch (error) {
                console.error("운동 기록 저장 중 오류 발생:", error);
                alert("운동 기록 저장에 실패했습니다. 다시 시도해 주세요.");
            }
        } else {
            try {
                await deleteDoc(workoutDocRef);
                alert("운동 완료 기록이 취소되었습니다.");
            } catch (error) {
                console.error("운동 기록 삭제 중 오류 발생:", error);
                alert("운동 기록 삭제에 실패했습니다. 다시 시도해 주세요.");
            }
        }
        checkDailyCompletion();
    } else {
        alert("로그인 후 이용해 주세요.");
    }
});


// 연속 성공 기록 및 캘린더를 불러오는 함수
async function loadWorkoutHistory(userId) {
    const completedDates = [];
    let streakCount = 0;

    try {
        const historyRef = collection(db, "users", userId, "workouts_completed");
        const querySnapshot = await getDocs(historyRef);
        
        querySnapshot.forEach(doc => {
            completedDates.push(doc.id);
        });
        
        let tempDate = new Date();
        while(true) {
            const dateString = tempDate.toISOString().split('T')[0];
            if (completedDates.includes(dateString)) {
                streakCount++;
                tempDate.setDate(tempDate.getDate() - 1);
            } else {
                break;
            }
        }
        
        streakCountElement.textContent = streakCount;
        renderCalendar(completedDates);

    } catch (error) {
        console.error("운동 기록 불러오기 중 오류 발생:", error);
    }
}


// 캘린더 그리는 함수
function renderCalendar(completedDates) {
    calendarContainer.innerHTML = '';
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const numDays = lastDay.getDate();
    
    let table = '<table><thead><tr><th>일</th><th>월</th><th>화</th><th>수</th><th>목</th><th>금</th><th>토</th></tr></thead><tbody><tr>';
    let dayOfWeek = firstDay.getDay();

    for (let i = 0; i < dayOfWeek; i++) {
        table += '<td></td>';
    }

    for (let day = 1; day <= numDays; day++) {
        if (dayOfWeek === 7) {
            table += '</tr><tr>';
            dayOfWeek = 0;
        }

        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isCompleted = completedDates.includes(dateString);
        
        const cellClass = isCompleted ? 'completed' : '';
        table += `<td class="${cellClass}">${day}</td>`;
        dayOfWeek++;
    }

    table += '</tr></tbody></table>';
    calendarContainer.innerHTML = table;
}

// 로그인 상태 변경 감지
onAuthStateChanged(auth, async (user) => {
    if (user) {
        authSection.style.display = 'none';
        mainApp.style.display = 'block';
        logoutButton.style.display = 'block';

        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            userNameElement.textContent = userData.name;
        } else {
            userNameElement.textContent = user.email;
        }
        
        displayDailyWorkout();
        checkDailyCompletion();

    } else {
        authSection.style.display = 'block';
        mainApp.style.display = 'none';
        logoutButton.style.display = 'none';
    }
});
// 추가: 영상 선택 기능

const playlistSelect = document.getElementById('playlist-select');
const videoSelect = document.getElementById('video-select');
const selectedWorkoutDisplay = document.getElementById('selected-workout-display');

// 유튜브 영상 ID 추출 함수 (이미 선언됨)
// function getYouTubeId(url) {...} // 중복 정의 피함

function createManualVideoHTML(video) {
    const videoId = getYouTubeId(video.url);
    if (!videoId) return `<p>잘못된 유튜브 주소입니다.</p>`;

    return `
        <h4>${video.title}</h4>
        <p>${video.category || ''} ${video.length ? video.length + '분' : ''}</p>
        <iframe class="video-embed" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>
        <br>
    `;
}

async function populatePlaylistDropdown() {
    try {
        const workoutsRef = collection(db, "운동영상");
        const querySnapshot = await getDocs(workoutsRef);
        const uniquePlaylists = [...new Set(querySnapshot.docs.map(doc => doc.data().category))];

        let optionsHTML = '<option value="">재생목록 선택</option>';
        uniquePlaylists.forEach(category => {
            if (category) {
                optionsHTML += `<option value="${category}">${category}</option>`;
            }
        });
        playlistSelect.innerHTML = optionsHTML;
    } catch (error) {
        console.error("재생목록 드롭다운 채우기 오류:", error);
    }
}

playlistSelect?.addEventListener('change', async (event) => {
    const selectedPlaylist = event.target.value;
    videoSelect.innerHTML = '<option value="">영상 제목 선택</option>';

    if (selectedPlaylist) {
        try {
            const workoutsRef = collection(db, "운동영상");
            const q = query(workoutsRef, where("category", "==", selectedPlaylist));
            const querySnapshot = await getDocs(q);

            let optionsHTML = '<option value="">영상 제목 선택</option>';
            querySnapshot.forEach(doc => {
                const video = doc.data();
                optionsHTML += `<option value="${doc.id}">${video.title}</option>`;
            });
            videoSelect.innerHTML = optionsHTML;
        } catch (error) {
            console.error("비디오 드롭다운 채우기 오류:", error);
        }
    } else {
        selectedWorkoutDisplay.innerHTML = '';
    }
});

videoSelect?.addEventListener('change', async (event) => {
    const selectedVideoId = event.target.value;

    if (selectedVideoId) {
        try {
            const videoDocRef = doc(db, "운동영상", selectedVideoId);
            const videoDocSnap = await getDoc(videoDocRef);

            if (videoDocSnap.exists()) {
                const videoData = videoDocSnap.data();
                selectedWorkoutDisplay.innerHTML = createManualVideoHTML(videoData);
            } else {
                selectedWorkoutDisplay.innerHTML = `<p>영상을 찾을 수 없습니다.</p>`;
            }
        } catch (error) {
            console.error("영상 로딩 중 오류 발생:", error);
            selectedWorkoutDisplay.innerHTML = `<p>오류가 발생했습니다. 잠시 후 다시 시도해 주세요.</p>`;
        }
    } else {
        selectedWorkoutDisplay.innerHTML = '';
    }
});

// 페이지 로드시 수동 영상 선택 영역도 준비
window.addEventListener('load', populatePlaylistDropdown);