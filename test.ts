const url = 'http://localhost:8001/api/automations/hooks/zendesk'

const response = await fetch(url, {
    method: 'GET',
    headers: {
        'Host': 'copilotz.com'
    }
})

console.log(response)

if (response.ok) {
    const data = await response.text();
    console.log(data);
} else {
    console.log('Error:', response.status);
}