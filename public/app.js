const form = document.getElementById('collectionForm');
const statusBox = document.getElementById('statusBox');
const resetBtn = document.getElementById('resetBtn');

const setStatus = (message, type = 'success') => {
  statusBox.textContent = message;
  statusBox.className = `status-box ${type}`;
  statusBox.classList.remove('hidden');
};

const resetStatus = () => {
  statusBox.classList.add('hidden');
  statusBox.className = 'status-box hidden';
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  resetStatus();

  const payload = {
    shopCode: document.getElementById('shopCode').value.trim(),
    entryNo: Number(document.getElementById('entryNo').value),
    staff: document.getElementById('staff').value.trim(),
    serviceType: document.getElementById('serviceType').value,
    amount: Number(document.getElementById('amount').value),
    costCutting: Number(document.getElementById('costCutting').value || 0),
    paymentMode: document.getElementById('paymentMode').value,
    email: document.getElementById('email').value.trim()
  };

  if (!payload.shopCode || !payload.serviceType || !payload.paymentMode || !payload.staff || !payload.entryNo || !payload.amount) {
    setStatus('Please fill all required fields.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/save-collection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong');
    }

    setStatus(`Collection saved successfully for ${payload.shopCode}.`, 'success');
    form.reset();
  } catch (error) {
    setStatus(error.message || 'Unable to save collection.', 'error');
  }
});

resetBtn.addEventListener('click', () => {
  form.reset();
  resetStatus();
});
