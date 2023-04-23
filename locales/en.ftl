language-changed = Language changed successfully!

start = 
  Hi! This bot allows you to quickly and conveniently use ChatGPT, without having to open a slow website.

  ChatGPT is an Artificial Intelligence model from OpenAI that can answer questions and perform various tasks. It's trained on an extremely large amount of textual information and can understand your messages really well.

  <b>We do not save the history of your correspondence with the bot.</b> Therefore, the model does not remember your previous requests and generates each response from scratch. To get the best result, write your requests in as much detail as possible and don't be afraid to experiment)

start-try =
  Go on, try it yourself! Just write any question and ChatGPT will generate a response for you)

  Also you can view interesting /examples of using ChatGPT)

examples =
  <b>Here are some examples of using ChatGPT</b>

  <i>Explain to me *(any-topic)* like to a 6-years-old.</i>

  <i>You are a professional writer. Rewrite this text in the style of a fictional novel without changing its meaning: …</i>

  <i>Write the 10 most fascinating facts from Churchill's biography.</i>

  <i>What are the most common problems faced by people learning programming?</i>
  
  <i>Help me write a letter with a request to take a day off from work, for the reason...</i>

  <i>Write 10 ideas for a profitable edtech startup, based on market data.</i>

  <i>Write the code for a simple Telegram bot in JavaScript.</i>

trial-ended = 
  Oops, looks like you've already used your 5 free requests today(
  New free requests are added daily.

  For unlimited access, you can purchase a low-cost subscription for <b>{ $monthPrice } UAH/month</b> or <b>{ $sixMonthsPrice } UAH/6 months</b>.

  It's much cheaper and more convenient than the official Pro plan from OpenAI, which costs <b>$20/month!</b>
  In addition, this way you will support a Ukrainian developer 🇺🇦🤘🏻

subscribe = Buy a subscription

you-are-subscribed = 
  Thank you for the payment! Your subscription has been successfully activated.
  It is valid until <b>{ $dateString }</b>

generating-response = Generating the response...

request-error = Sorry, an error occurred while generating your request( Please contact @ivryb

payment-instructions =
  1. Here is your payment link: { $payLink }
  Transfer { $monthPrice } UAH for a 1 month subscription, or { $sixMonthsPrice } UAH for six months.

  2. Click the button below to notify us of successful payment and continue using the bot)

  Thank you for staying with us 🙏🏻

i-paid = Payment sent

checking-payment = Thank you! We will check the payment status and notify you about the subscription activation ASAP 😇

help =
  <b>Available bot commands:</b>
  /examples — examples of ChatGPT usage
  /balance — your balance
  /language — language selection

  If you have any questions or suggestions for improving this bot, you can always contact the developer — @ivryb

balance =
  Subscription status: <b>Unsubscribed</b>
  Free requests for today: <b>{ $freeRequests }</b>

balancePaid =
  Subscription status: <b>Subscribed</b>
  Subscription valid until: <b>{ $paidUntil }</b>