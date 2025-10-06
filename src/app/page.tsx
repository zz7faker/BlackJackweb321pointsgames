"use client";

import { useState, useEffect, useMemo } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

export default function Page() {
  const API_BASE_URL = '/api';
  const { address, isConnected } = useAccount();
  const shortAddr = useMemo(() => address ? `${address.slice(0,6)}...${address.slice(-4)}` : '未连接', [address]);

  // 定义卡片
  interface Card { value: string; suit: string; }
  interface CardDisplayProps { card: Card; hidden: boolean; index: number; isFlipping: boolean; }

  const [playerScore, setPlayerScore] = useState(500);
  const [dealerCards, setDealerCards] = useState<Card[]>([]);
  const [playerCards, setPlayerCards] = useState<Card[]>([]);
  const [dealerTotal, setDealerTotal] = useState(0);
  const [playerTotal, setPlayerTotal] = useState(0);
  const [message, setMessage] = useState('点击 Reset 开始游戏');
  const [gameActive, setGameActive] = useState(false);
  const [dealerTurn, setDealerTurn] = useState(false);
  const [showNFTModal, setShowNFTModal] = useState(false);
  const [cardAnimation, setCardAnimation] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [welcomeAnimation, setWelcomeAnimation] = useState<'entering'|'leaving'>('entering');
  const [dealerFlipping, setDealerFlipping] = useState(false);

  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  // === 与后端交互 ===
  const loadScore = async () => {
    if (!isConnected || !address) return;
    try {
      const res = await fetch(`${API_BASE_URL}?address=${address}`);
      const data = await res.json();
      if (typeof data?.score === 'number') setPlayerScore(data.score);
    } catch (e) { console.error('加载分数失败:', e); }
  };

  const saveScore = async (newScore: number) => {
    if (!isConnected || !address) return;
    try {
      await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, score: newScore }),
      });
    } catch (e) { console.error('保存分数失败:', e); }
  };

  useEffect(() => { loadScore(); }, [isConnected, address]);

  // === 游戏逻辑 ===
  const getRandomCard = () => {
    const suit = suits[Math.floor(Math.random() * suits.length)];
    const value = values[Math.floor(Math.random() * values.length)];
    return { suit, value };
  };

  const getCardValue = (card: Card) => {
    if (card.value === 'A') return 11;
    if (['J', 'Q', 'K'].includes(card.value)) return 10;
    return parseInt(card.value);
  };

  const calculateTotal = (cards: Card[]) => {
    let total = cards.reduce((sum, card) => sum + getCardValue(card), 0);
    let aces = cards.filter(card => card.value === 'A').length;
    while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
    return total;
  };

  useEffect(() => { if (dealerCards.length > 0) setDealerTotal(calculateTotal(dealerCards)); }, [dealerCards]);

  useEffect(() => {
    if (playerCards.length > 0) {
      const total = calculateTotal(playerCards);
      setPlayerTotal(total);
      if (total === 21 && playerCards.length === 2 && gameActive && !dealerTurn) {
        setTimeout(() => { endGame('🎊 BLACKJACK! 完美21点!', true, true); }, 500);
      }
    }
  }, [playerCards]);

  useEffect(() => {
    if (!gameActive) return;
  
    // 爆牌：立即结束
    if (playerTotal > 21) {
      endGame('💥 Player 爆牌! Dealer 赢了!', false);
      return;
    }
  
    // 首发两张、天然 21：直接 Blackjack 胜利（无需等待 Dealer）
    if (playerTotal === 21 && playerCards.length === 2 && !dealerTurn) {
      endGame('🎊 BLACKJACK! 完美21点!', true, true);
      return;
    }
  
    // 非首发，通过 Hit 达到 21：自动进入 Dealer 回合
    if (playerTotal === 21 && playerCards.length >= 3 && !dealerTurn) {
      setMessage('✅ 你到 21 了，轮到 Dealer...');
      setTimeout(() => setDealerTurn(true), 400);
    }
  }, [playerTotal, gameActive, dealerTurn, playerCards.length]);

  useEffect(() => {
    if (dealerTurn && dealerTotal < 17) {
      setTimeout(() => {
        setCardAnimation(true);
        setDealerCards(prev => [...prev, getRandomCard()]);
        setTimeout(() => setCardAnimation(false), 300);
      }, 1200);
    } else if (dealerTurn && dealerTotal >= 17) {
      setTimeout(() => { determineWinner(); }, 800);
    }
  }, [dealerTurn, dealerTotal]);

  useEffect(() => {
    if (!isConnected) {
      setGameActive(false);
      setDealerTurn(false);
      setDealerCards([]);
      setPlayerCards([]);
      setDealerTotal(0);
      setPlayerTotal(0);
      setMessage('请先连接钱包');
      setShowWelcome(true);
      setWelcomeAnimation('entering');
    }
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected || !address) return;

    // 账号切换：清盘 & 文案提示
    setGameActive(false);
    setDealerTurn(false);
    setDealerCards([]);
    setPlayerCards([]);
    setDealerTotal(0);
    setPlayerTotal(0);
    setMessage('已切换账号，点击【Reset】或【开始游戏】开启新的一局');

    // 重新加载分数
    loadScore();
  }, [address]); // 仅地址变更时触发

  const startGame = () => {
    if (!isConnected) { setMessage('请先连接钱包'); return; }
    setCardAnimation(true);
    const newDealerCards: Card[] = [getRandomCard(), getRandomCard()];
    const newPlayerCards: Card[] = [getRandomCard(), getRandomCard()];
    setDealerCards(newDealerCards);
    setPlayerCards(newPlayerCards);
    setGameActive(true);
    setDealerTurn(false);
    setMessage('🎮 游戏开始! 选择 Hit 或 Stand');
    setTimeout(() => setCardAnimation(false), 300);
  };

  const hit = () => {
    if (!gameActive || dealerTurn) return;
    setCardAnimation(true);
    setPlayerCards(prev => [...prev, getRandomCard()]);
    setTimeout(() => setCardAnimation(false), 300);
  };

  const stand = () => {
    if (!gameActive || dealerTurn) return;
    setDealerTurn(true);
    setMessage('⏳ Dealer 开始要牌...');
    setDealerFlipping(true);
    setTimeout(() => setDealerFlipping(false), 600);
  };

  const determineWinner = () => {
    if (dealerTotal > 21) endGame('🎉 Dealer 爆牌! Player 赢了!', true);
    else if (dealerTotal > playerTotal) endGame('😔 Dealer 赢了!', false);
    else if (playerTotal > dealerTotal) endGame('🎉 Player 赢了!', true);
    else endGame('🤝 平局!', null);
  };

  const endGame = (result: string, playerWon: boolean | null, isBlackjack = false) => {
    setMessage(result);
    setGameActive(false);
    setDealerTurn(false);

    let scoreChange = 0;
    let newScore = playerScore;

    if (playerWon === true) {
      scoreChange = isBlackjack ? 150 : 100;
      newScore = playerScore + scoreChange;
      setPlayerScore(newScore);
    } else if (playerWon === false) {
      scoreChange = -50;
      newScore = Math.max(0, playerScore - 50);
      setPlayerScore(newScore);
    }

    if (scoreChange !== 0) saveScore(newScore);
  };

  const reset = () => {
    setDealerCards([]);
    setPlayerCards([]);
    setDealerTotal(0);
    setPlayerTotal(0);
    setGameActive(false);
    setDealerTurn(false);
    setMessage('🎲 准备开始新游戏...');
    setTimeout(() => startGame(), 500);
  };

  const claimNFT = () => setShowNFTModal(true);

  const startGameFromWelcome = () => {
    if (!isConnected) { setMessage('请先右上角连接钱包'); return; }
    setWelcomeAnimation('leaving');
    setTimeout(() => { setShowWelcome(false); }, 500);
    setTimeout(() => { startGame(); }, 550);
  };

  // 放大卡片：w-32 h-48（≈128×192）
  const CardDisplay = ({ card, hidden, index, isFlipping }: CardDisplayProps) => {
    if (hidden) {
      return (
        <div className={`w-32 h-48 bg-gradient-to-br from-indigo-600 to-purple-800 border-2 border-indigo-900 rounded-2xl flex items-center justify-center shadow-2xl transition-transform duration-300 hover:scale-105 ${isFlipping ? 'animate-flip' : ''}`}>
          <div className="text-white text-6xl font-bold">?</div>
        </div>
      );
    }
    const isRed = card.suit === '♥' || card.suit === '♦';
    return (
      <div
        className={`w-32 h-48 bg-white border-2 border-gray-200 rounded-2xl p-3 flex flex-col justify-between shadow-xl transition-transform duration-300 hover:scale-105 ${cardAnimation ? 'animate-bounce' : ''} ${isFlipping ? 'animate-flip' : ''}`}
        style={{ animation: cardAnimation ? `slideIn 0.3s ease-out ${index * 0.08}s` : isFlipping ? 'flip 0.6s ease-in-out' : 'none' }}
      >
        <div className={`font-bold ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
          <div className="text-4xl leading-none mb-1">{card.value}</div>
          <div className="text-2xl">{card.suit}</div>
        </div>
        <div className={`font-bold self-end rotate-180 ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
          <div className="text-4xl leading-none">{card.value}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 p-4 md:p-8 relative overflow-hidden">
      {/* 顶部：连接钱包 */}
      <div className="fixed top-4 right-4 z-50">
        <ConnectButton />
      </div>

      {/* 背景装饰 */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-20 left-20 w-40 h-40 bg-blue-400 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-60 h-60 bg-purple-400 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-pink-400 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      {/* 欢迎页（保持原有样式） */}
      {showWelcome && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500 ${welcomeAnimation === 'leaving' ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600 via-indigo-600 to-sky-500" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12),transparent_60%)]" />
          <div className="relative z-10 max-w-3xl w-full px-6">
            <div className="rounded-[28px] backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl p-12 md:p-16 text-center">
              <div className="text-7xl md:text-8xl mb-6">🎰</div>
              <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Blackjack 21</h1>
              <p className="mt-4 text-white/85 text-xl md:text-2xl">挑战你的运气</p>
              <div className="mt-8 flex items-center justify-center">
                <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
              </div>
              <button
                onClick={startGameFromWelcome}
                disabled={!isConnected}
                className="mt-9 inline-flex items-center gap-2 px-10 py-5 rounded-full font-semibold text-indigo-950 text-lg md:text-xl bg-gradient-to-r from-amber-300 to-orange-400 shadow-xl hover:shadow-amber-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                🎮 开始游戏
              </button>
              <p className="mt-7 text-sm md:text-base text-white/70">↓ 点击开始你的幸运之旅 ↓</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-8xl mx-auto relative z-10 w-full">
        {/* 顶部标题与规则条 */}
        <div className="text-center mb-4 md:mb-6">
          <h1 className="text-[40px] md:text-[56px] leading-tight font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600">🎰 Blackjack 21</h1>
          <p className="mt-1 text-gray-700 text-base md:text-lg font-semibold">挑战你的运气!</p>
        </div>

        <div className="mb-8">
          <div className="w-full text-center font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl shadow-2xl px-6 py-4 md:px-8 md:py-5">
            <div className="text-base md:text-lg lg:text-xl leading-relaxed tracking-wide">
              <span className="inline-block mr-2">💰 初始: <span className="font-extrabold">500</span> 分</span> |
              <span className="inline-block mx-2"> 🎯 赢 <span className="font-extrabold">+100</span> 分</span> |
              <span className="inline-block mx-2"> 🎊 21点 <span className="font-extrabold">+150</span> 分</span> |
              <span className="inline-block mx-2"> 💔 输 <span className="font-extrabold">-50</span> 分</span> |
              <span className="inline-block ml-2"> 🏆 达到 <span className="font-extrabold">1000</span> 分领 NFT</span>
            </div>
          </div>
        </div>

        {/* 三栏主布局：左=分数/状态（两块各≈260px） | 中=牌区（上下两块各≈260px） | 右=小按钮列 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">

          {/* 左列 */}
          <div className="md:col-span-3 grid grid-rows-2 gap-22">
            {/* 分数显示（固定高度） */}
            <div className="h-[240px] md:h-[260px] bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-6 shadow-2xl flex flex-col justify-center">
              <div className="text-white text-center">
                <div className="text-sm mb-1 opacity-80">当前分数</div>
                <div className="text-5xl md:text-6xl font-extrabold mb-2">{playerScore}</div>
                <div className="text-xs opacity-90">距离NFT: {Math.max(0, 1000 - playerScore)} 分</div>
                {playerScore >= 1000 && (
                  <button
                    onClick={() => setShowNFTModal(true)}
                    className="mt-4 w-full px-6 py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-purple-900 font-bold rounded-lg shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
                  >
                    🎁 领取NFT
                  </button>
                )}
              </div>
            </div>

            {/* 游戏状态（固定高度） */}
            <div className="h-[240px] md:h-[260px] bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 shadow-2xl">
              <div className="text-white text-center h-full flex flex-col">
                <div className="text-sm mb-2 opacity-80">游戏状态</div>
                <div className="text-lg md:text-xl font-bold mb-4 flex-1 flex items-center justify-center">
                  {!isConnected ? '请先连接钱包' : message}
                </div>
                <div className="grid grid-cols-2 text-sm gap-4">
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="opacity-80">Dealer</div>
                    <div className="font-bold text-2xl">{dealerTotal > 0 ? ((dealerTurn || !gameActive) ? dealerTotal : '?') : '-'}</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="opacity-80">Player</div>
                    <div className="font-bold text-2xl">{playerTotal || '-'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 中列（牌区），每块最小高度对齐左列 */}
          <div className="md:col-span-6 space-y-6">
            {/* Dealer */}
            <div className="min-h-[240px] md:min-h-[260px] bg-white/70 backdrop-blur-lg rounded-2xl p-6 shadow-2xl border border-purple-200">
              <h2 className="text-2xl md:text-3xl font-bold text-purple-700 mb-4 flex items-center gap-3">
                🎩 Dealer's Hand
                {dealerTotal > 0 && (
                  <span className="text-white bg-gradient-to-r from-red-500 to-pink-500 px-3 py-1 rounded-full text-base md:text-xl shadow-lg">
                    {(dealerTurn || !gameActive) ? dealerTotal : '?'}
                  </span>
                )}
              </h2>
              <div className="flex gap-5 flex-wrap justify-center">
                {dealerCards.length > 0 ? (
                  dealerCards.map((card, index) => (
                    <CardDisplay
                      key={index}
                      card={card}
                      index={index}
                      hidden={index === 0 && gameActive && !dealerTurn}
                      isFlipping={index === 0 && dealerFlipping}
                    />
                  ))
                ) : (
                  <div className="text-gray-500 opacity-70 text-xl py-8">等待发牌...</div>
                )}
              </div>
            </div>

            {/* Player */}
            <div className="min-h-[240px] md:min-h-[260px] bg-white/70 backdrop-blur-lg rounded-2xl p-6 shadow-2xl border border-blue-200">
              <h2 className="text-2xl md:text-3xl font-bold text-blue-700 mb-4 flex items-center gap-3">
                👤 Player's Hand
                {playerTotal > 0 && (
                  <span
                    className={`text-white px-3 py-1 rounded-full text-base md:text-xl shadow-lg ${
                      playerTotal === 21
                        ? 'bg-gradient-to-r from-yellow-400 to-orange-500'
                        : playerTotal > 21
                        ? 'bg-gradient-to-r from-red-500 to-pink-500'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500'
                    }`}
                  >
                    {playerTotal}
                  </span>
                )}
              </h2>
              <div className="flex gap-5 flex-wrap justify-center">
                {playerCards.length > 0 ? (
                  playerCards.map((card, index) => (
                    <CardDisplay key={index} card={card} index={index} hidden={false} isFlipping={false} />
                  ))
                ) : (
                  <div className="text-gray-500 opacity-70 text-xl py-8">等待发牌...</div>
                )}
              </div>
            </div>
          </div>

          {/* 右列：操作按钮（更高、更窄） */}
          <div className="md:col-span-3">
            <div className="sticky top-24 ml-[20px] mr-[10px] max-w-[400px] w-full space-y-4">
              <div className="text-gray-700 font-semibold mb-1 flex items-center gap-2">
                <span className="text-lg">操作区</span> <span>🎮</span>
              </div>

              <button
                onClick={hit}
                disabled={!gameActive || dealerTurn || !isConnected}
                className="w-full px-6 py-7 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold rounded-2xl shadow-2xl hover:shadow-blue-500/50 disabled:from-gray-400 disabled:to-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 text-lg transform hover:scale-[1.02] active:scale-95"
              >
                📲 Hit
                <div className="text-sm font-normal opacity-90">要牌</div>
              </button>

              <button
                onClick={stand}
                disabled={!gameActive || dealerTurn || !isConnected}
                className="w-full px-6 py-7 bg-gradient-to-r from-orange-500 to-pink-600 text-white font-bold rounded-2xl shadow-2xl hover:shadow-orange-500/50 disabled:from-gray-400 disabled:to-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 text-lg transform hover:scale-[1.02] active:scale-95"
              >
                ✋ Stand
                <div className="text-sm font-normal opacity-90">停牌</div>
              </button>

              {/* 只在未进行游戏 && 已连接时显示 Reset */}
              {!gameActive && isConnected && (
                <button
                  onClick={reset}
                  className="w-full px-6 py-7 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-2xl shadow-2xl hover:shadow-green-500/50 transition-all duration-300 text-lg transform hover:scale-[1.02] active:scale-95"
                >
                  🔄 Reset
                  <div className="text-sm font-normal opacity-90">新游戏</div>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* NFT 领取弹窗（呼吸效果，无跳跃） */}
      {showNFTModal && (
        <div className="fixed inset-0 bg-gradient-to-br from-purple-900/80 via-blue-900/80 to-pink-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div
            className="
              bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500
              rounded-2xl p-8 max-w-md w-full shadow-2xl border-4 border-yellow-300
              relative overflow-hidden
              animate-breathe
            "
          >
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-300/30 to-pink-300/30 animate-pulse" />
            <div className="text-center text-white relative z-10">
              <div className="text-6xl mb-4 animate-pulse">🎉</div>
              <h3 className="text-3xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-400">
                恭喜你!
              </h3>
              <p className="text-xl mb-2">你已达到1000分！</p>
              <p className="text-lg mb-6 opacity-90">可以领取专属NFT奖励 🎁</p>
              <div className="text-8xl mb-6 animate-pulse" style={{ animationDuration: '2s' }}>🏆</div>
              <button
                onClick={() => setShowNFTModal(false)}
                className="
                  px-8 py-3 bg-gradient-to-r from-yellow-300 to-orange-400
                  text-purple-900 font-bold rounded-lg shadow-lg
                  hover:shadow-2xl transition-all duration-300
                "
              >
                确认领取
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-20px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes flip {
          0% { transform: rotateY(0deg) scale(1); }
          50% { transform: rotateY(90deg) scale(1.06); }
          100% { transform: rotateY(0) scale(1); }
        }
        .animate-flip { animation: flip 0.6s ease-in-out; }

        /* 新增：呼吸动画（轻微缩放），替代 bounce */
        @keyframes breathe {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        .animate-breathe {
          animation: breathe 2.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
