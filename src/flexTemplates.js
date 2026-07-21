/**
 * Helper to get bank styling properties based on bank name (case-insensitive Thai/English)
 */
function getBankStyle(bankName = '') {
  const name = bankName.toLowerCase().trim();
  
  if (name.includes('กสิกร') || name.includes('kbank')) {
    return { bgColor: '#138048', textColor: '#FFFFFF', label: 'KBANK' };
  }
  if (name.includes('ไทยพาณิชย์') || name.includes('scb')) {
    return { bgColor: '#4E2A84', textColor: '#FFFFFF', label: 'SCB' };
  }
  if (name.includes('กรุงศรี') || name.includes('krungsri') || name.includes('bay')) {
    return { bgColor: '#FBB03B', textColor: '#1A1A1A', label: 'KRUNGSRI' };
  }
  if (name.includes('กรุงเทพ') || name.includes('bbl') || name.includes('bangkok')) {
    return { bgColor: '#0050A0', textColor: '#FFFFFF', label: 'BBL' };
  }
  if (name.includes('กรุงไทย') || name.includes('ktb')) {
    return { bgColor: '#00A3E0', textColor: '#FFFFFF', label: 'KTB' };
  }
  if (name.includes('ทหารไทย') || name.includes('ธนชาต') || name.includes('ttb')) {
    return { bgColor: '#002D62', textColor: '#FFFFFF', label: 'TTB' };
  }
  if (name.includes('พร้อมเพย์') || name.includes('promptpay') || name.includes('promtpay') || name.includes('pp')) {
    return { bgColor: '#007A87', textColor: '#FFFFFF', label: 'PROMPTPAY' };
  }
  if (name.includes('ออมสิน') || name.includes('gsb')) {
    return { bgColor: '#EC008C', textColor: '#FFFFFF', label: 'GSB' };
  }
  
  return { bgColor: '#1F2937', textColor: '#FFFFFF', label: bankName.toUpperCase() || 'BANK' };
}

/**
 * Renders a single bank card Flex Bubble
 */
function makeBankCardBubble(user) {
  const style = getBankStyle(user.bankName);
  const accountNoDisplay = user.accountNumber || 'ไม่ได้ระบุ';
  const accountNameDisplay = user.accountName || user.displayName || 'ไม่ได้ระบุ';
  
  return {
    type: 'bubble',
    size: 'mega',
    styles: {
      header: { backgroundColor: style.bgColor },
      body: { backgroundColor: '#FFFFFF' },
      footer: { backgroundColor: '#F9FAFB' }
    },
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: style.label,
          weight: 'bold',
          color: style.textColor,
          size: 'lg'
        },
        {
          type: 'text',
          text: 'ACCOUNT CARD (สายสมรบันทึกไว้ให้แล้วยะ)',
          size: 'xxs',
          color: style.textColor === '#FFFFFF' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
          margin: 'xs'
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'xxs',
          contents: [
            {
              type: 'text',
              text: 'เจ้าของบัญชี (Owner)',
              size: 'xxs',
              color: '#9CA3AF'
            },
            {
              type: 'text',
              text: accountNameDisplay,
              weight: 'bold',
              size: 'md',
              color: '#1F2937'
            }
          ]
        },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'xxs',
          contents: [
            {
              type: 'text',
              text: 'เลขที่บัญชี / เบอร์พร้อมเพย์',
              size: 'xxs',
              color: '#9CA3AF'
            },
            {
              type: 'text',
              text: accountNoDisplay,
              weight: 'bold',
              size: 'xl',
              color: style.bgColor
            }
          ]
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: style.bgColor,
          height: 'sm',
          action: {
            type: 'clipboard',
            label: '📋 คัดลอกเลขบัญชี',
            clipboardText: accountNoDisplay.replace(/[^0-9]/g, '')
          }
        }
      ]
    }
  };
}

/**
 * Flex message for bank account confirmation
 */
function bankRegisterSuccess(user) {
  const card = makeBankCardBubble(user);
  return {
    type: 'flex',
    altText: `💃 บันทึกบัญชีของ ${user.displayName} เรียบร้อยแล้วยะ!`,
    contents: card
  };
}

/**
 * Flex Carousel for registered accounts in group
 */
function accountsCarousel(users) {
  if (users.length === 0) {
    return {
      type: 'text',
      text: 'ว้ายยย! ยังไม่มีใครบันทึกบัญชีเลยยะ! พิมพ์ "บันทึกบัญชี [ธนาคาร] [เลขบัญชี] [ชื่อ]" ด่วนๆ เลย!'
    };
  }

  const bubbles = users.map(user => makeBankCardBubble(user));

  return {
    type: 'flex',
    altText: 'ข้อมูลเลขบัญชีของเพื่อนในกลุ่ม',
    contents: {
      type: 'carousel',
      contents: bubbles.slice(0, 10)
    }
  };
}

/**
 * Active party/bill join interface
 */
function partyJoinCard(bill) {
  const participantCount = bill.participants.length;
  const isMulti = bill.type === 'multi';
  
  let participantsSection = [];
  if (participantCount === 0) {
    participantsSection.push({
      type: 'text',
      text: 'ยังไม่มีใครกดเข้าร่วมเลย! อย่ามาเนียนกินฟรีนะกดปุ่มเข้าร่วมเเดี๋ยวนี้!',
      size: 'xs',
      color: '#EF4444',
      style: 'italic'
    });
  } else {
    const names = bill.participants.map(p => p.displayName).join(', ');
    participantsSection.push({
      type: 'text',
      text: `👥 เข้าร่วมแล้ว (${participantCount} คน):`,
      size: 'xs',
      color: '#4B5563',
      weight: 'bold'
    });
    participantsSection.push({
      type: 'text',
      text: names,
      size: 'xs',
      color: '#1F2937',
      wrap: true,
      margin: 'xs'
    });
  }

  let expenseSection = [];
  if (isMulti) {
    expenseSection.push({
      type: 'separator',
      margin: 'md'
    });
    expenseSection.push({
      type: 'text',
      text: '💰 รายการที่ออกเงินไปก่อน (สายสมรจดไว้):',
      size: 'xs',
      color: '#4B5563',
      weight: 'bold',
      margin: 'md'
    });

    if (bill.payers.length === 0) {
      expenseSection.push({
        type: 'text',
        text: 'ยังไม่มีใครลงรายการ! พิมพ์ "จ่าย [ยอด] ค่า [รายการ]" มาเพิ่มสิยะ!',
        size: 'xs',
        color: '#9CA3AF',
        style: 'italic',
        margin: 'xs'
      });
    } else {
      let totalAmount = 0;
      bill.payers.forEach(p => {
        totalAmount += p.amountPaid;
        expenseSection.push({
          type: 'box',
          layout: 'horizontal',
          margin: 'xs',
          contents: [
            {
              type: 'text',
              text: `• ${p.displayName} จ่ายค่า${p.itemName || 'รายการ'}`,
              size: 'xs',
              color: '#374151',
              flex: 3
            },
            {
              type: 'text',
              text: `${p.amountPaid.toLocaleString('th-TH')} บ.`,
              size: 'xs',
              weight: 'bold',
              color: '#1F2937',
              align: 'end',
              flex: 1
            }
          ]
        });
      });
      expenseSection.push({
        type: 'box',
        layout: 'horizontal',
        margin: 'sm',
        contents: [
          {
            type: 'text',
            text: 'ยอดรวมทั้งหมด (Total)',
            size: 'xs',
            weight: 'bold',
            color: '#EC4899',
            flex: 2
          },
          {
            type: 'text',
            text: `${totalAmount.toLocaleString('th-TH')} บาท`,
            size: 'xs',
            weight: 'bold',
            color: '#EC4899',
            align: 'end',
            flex: 2
          }
        ]
      });
    }
  } else {
    expenseSection.push({
      type: 'separator',
      margin: 'md'
    });
    expenseSection.push({
      type: 'box',
      layout: 'horizontal',
      margin: 'md',
      contents: [
        {
          type: 'text',
          text: 'ยอดรวมมื้อนี้',
          size: 'sm',
          color: '#4B5563'
        },
        {
          type: 'text',
          text: `${bill.totalAmount ? bill.totalAmount.toLocaleString('th-TH') : '0'} บาท`,
          size: 'md',
          weight: 'bold',
          color: '#BE185D',
          align: 'end'
        }
      ]
    });
    
    if (participantCount > 0 && bill.totalAmount) {
      const splitAmount = Math.round((bill.totalAmount / participantCount) * 100) / 100;
      expenseSection.push({
        type: 'box',
        layout: 'horizontal',
        margin: 'xs',
        contents: [
          {
            type: 'text',
            text: 'เฉลี่ยคนละ',
            size: 'sm',
            color: '#6B7280'
          },
          {
            type: 'text',
            text: `${splitAmount.toLocaleString('th-TH')} บาท`,
            size: 'md',
            weight: 'bold',
            color: '#EC4899',
            align: 'end'
          }
        ]
      });
    }
  }

  return {
    type: 'flex',
    altText: `บิลของสายสมร: ${bill.title}`,
    contents: {
      type: 'bubble',
      styles: {
        header: { backgroundColor: '#BE185D' },
        body: { backgroundColor: '#FFFFFF' },
        footer: { backgroundColor: '#FDF2F8' }
      },
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: isMulti ? '📢 สายสมรเปิดรับลงรายจ่ายปาร์ตี้!' : '💸 สายสมรเปิดหารเท่ากันมื้อนี้!',
            weight: 'bold',
            color: '#FFFFFF',
            size: 'sm'
          },
          {
            type: 'text',
            text: bill.title,
            weight: 'bold',
            color: '#FFFFFF',
            size: 'xl',
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          ...participantsSection,
          ...expenseSection,
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: '💡 คำสั่งสายสมร:',
                size: 'xxs',
                color: '#6B7280',
                weight: 'bold'
              },
              {
                type: 'text',
                text: isMulti ? '1. กด [🙋‍♂️ เข้าร่วม] ด่วนๆ ห้ามเนียน!\n2. พิมพ์ "จ่าย [ยอด] ค่า [รายการ]" บันทึกเงินที่ออกไปก่อน' : '1. กด [🙋‍♂️ เข้าร่วมหาร]\n2. ครบแล้ว กด [✅ สรุปยอด]',
                size: 'xxs',
                color: '#9CA3AF',
                wrap: true
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#EC4899',
            action: {
              type: 'postback',
              label: '🙋‍♂️ เข้าร่วมหารด่วนๆ',
              data: `action=join&billId=${bill.id}`
            }
          },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'button',
                style: 'secondary',
                color: '#059669',
                flex: 1,
                action: {
                  type: 'postback',
                  label: '✅ สรุปยอดเงิน',
                  data: `action=settle&billId=${bill.id}`
                }
              },
              {
                type: 'button',
                style: 'link',
                color: '#DC2626',
                flex: 1,
                action: {
                  type: 'postback',
                  label: '❌ ยกเลิกบิล',
                  data: `action=cancel&billId=${bill.id}`
                }
              }
            ]
          }
        ]
      }
    }
  };
}

/**
 * Flex template to show rebalancing settlement transfer guide
 */
function rebalanceSettlementCard(bill, db) {
  const isMulti = bill.type === 'multi';
  const totalAmount = isMulti
    ? bill.payers.reduce((sum, p) => sum + p.amountPaid, 0)
    : bill.totalAmount;
  const participantCount = bill.participants.length;
  const splitAmount = participantCount > 0 ? (totalAmount / participantCount) : 0;
  
  let headerText = '📋 สายสมรคิดเงินเคลียร์ยอด!';

  let transfersBox = [];
  if (!bill.transfers || bill.transfers.length === 0) {
    transfersBox.push({
      type: 'text',
      text: '🎉 ว้ายยย! ทุกคนจ่ายเงินเท่ากันพอดีเป๊ะ ไม่ต้องโอนคืนใครจ้า!',
      size: 'sm',
      color: '#059669',
      weight: 'bold',
      wrap: true
    });
  } else {
    transfersBox.push({
      type: 'text',
      text: '👇 รายการโอนเงินคืน (อย่าให้สายสมรต้องตามทวงนะ!):',
      size: 'xs',
      color: '#4B5563',
      weight: 'bold'
    });

    bill.transfers.forEach((t) => {
      const receiver = db.getUser(t.toUserId);
      let bankInfoText = 'ยังไม่ได้ลงบันทึกบัญชีไว้ในระบบ!';
      let copyText = '';
      let style = getBankStyle('');

      if (receiver && receiver.bankName && receiver.accountNumber) {
        style = getBankStyle(receiver.bankName);
        bankInfoText = `${style.label}: ${receiver.accountNumber}\n(${receiver.accountName || receiver.displayName})`;
        copyText = receiver.accountNumber.replace(/[^0-9]/g, '');
      }

      const transferBubble = {
        type: 'box',
        layout: 'vertical',
        margin: 'md',
        borderColor: '#FBCFE8',
        borderWidth: '1px',
        cornerRadius: 'md',
        paddingAll: 'md',
        backgroundColor: '#FFF1F2',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: `${t.fromName}`,
                weight: 'bold',
                size: 'sm',
                color: '#DC2626',
                flex: 2
              },
              {
                type: 'text',
                text: 'โอนให้ ➡️',
                size: 'xxs',
                color: '#9CA3AF',
                align: 'center',
                flex: 1,
                gravity: 'center'
              },
              {
                type: 'text',
                text: `${t.toName}`,
                weight: 'bold',
                size: 'sm',
                color: '#059669',
                align: 'end',
                flex: 2
              }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              {
                type: 'text',
                text: 'ยอดโอนด่วน (Transfer):',
                size: 'xs',
                color: '#6B7280',
                flex: 2
              },
              {
                type: 'text',
                text: `${t.amount.toLocaleString('th-TH')} บาท`,
                weight: 'bold',
                size: 'md',
                color: '#BE185D',
                align: 'end',
                flex: 2
              }
            ]
          },
          {
            type: 'separator',
            margin: 'sm'
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            spacing: 'sm',
            contents: [
              {
                type: 'text',
                text: bankInfoText,
                size: 'xxs',
                color: '#4B5563',
                wrap: true,
                flex: 3
              },
              ...(copyText ? [{
                type: 'button',
                style: 'secondary',
                color: style.bgColor,
                height: 'xs',
                flex: 2,
                action: {
                  type: 'clipboard',
                  label: '📋 คัดลอกเลข',
                  clipboardText: copyText
                }
              }] : [])
            ]
          }
        ]
      };
      
      transfersBox.push(transferBubble);
    });
  }

  const summaryDetails = [
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: 'ยอดรวมทั้งสิ้น (Total)',
          size: 'xs',
          color: '#6B7280'
        },
        {
          type: 'text',
          text: `${totalAmount.toLocaleString('th-TH')} บาท`,
          size: 'xs',
          weight: 'bold',
          color: '#1F2937',
          align: 'end'
        }
      ]
    },
    {
      type: 'box',
      layout: 'horizontal',
      margin: 'xs',
      contents: [
        {
          type: 'text',
          text: `เฉลี่ยคนละ (${participantCount} คน)`,
          size: 'xs',
          color: '#6B7280'
        },
        {
          type: 'text',
          text: `${Math.round(splitAmount * 100) / 100} บาท`,
          size: 'xs',
          weight: 'bold',
          color: '#EC4899',
          align: 'end'
        }
      ]
    }
  ];

  return {
    type: 'flex',
    altText: `สรุปบิลของสายสมร: ${bill.title}`,
    contents: {
      type: 'bubble',
      styles: {
        header: { backgroundColor: '#BE185D' },
        body: { backgroundColor: '#FFFFFF' },
        footer: { backgroundColor: '#FDF2F8' }
      },
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: headerText,
            weight: 'bold',
            color: '#FFFFFF',
            size: 'md'
          },
          {
            type: 'text',
            text: bill.title,
            weight: 'bold',
            color: '#FFFFFF',
            size: 'xl',
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: summaryDetails
          },
          {
            type: 'separator'
          },
          ...transfersBox
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#BE185D',
            action: {
              type: 'postback',
              label: '🎉 เคลียร์เงินเสร็จสิ้น (ปิดบิล)',
              data: `action=close&billId=${bill.id}`
            }
          }
        ]
      }
    }
  };
}

module.exports = {
  bankRegisterSuccess,
  accountsCarousel,
  partyJoinCard,
  rebalanceSettlementCard
};
